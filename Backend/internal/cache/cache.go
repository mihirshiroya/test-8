// Package cache implements optional Redis-backed response and user caching.
//
// Caching is strictly best-effort: when REDIS_URL is unset or Redis is
// unreachable every operation is a no-op and the API serves straight from the
// database. Keys use the same layout as the Node backend so both versions can
// share a Redis instance during a rollout.
//
// Invalidation: every cached response key embeds a version for its
// namespace + scope. Writes bump that version with an atomic INCR, which
// orphans all older keys at once; orphaned keys expire through their TTL.
package cache

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"

	"productivity/internal/reqctx"
)

const (
	Prefix     = "cache"
	versionTTL = 7 * 24 * time.Hour
	userTTL    = 5 * time.Minute
	opTimeout  = 750 * time.Millisecond
)

type Cache struct {
	client *redis.Client
	ready  atomic.Bool
	log    *slog.Logger
	stop   chan struct{}
}

// New connects to Redis when url is non-empty. A nil-client Cache is valid and
// disables caching.
func New(url string, log *slog.Logger) (*Cache, error) {
	c := &Cache{log: log, stop: make(chan struct{})}
	if url == "" {
		log.Info("REDIS_URL not set, response caching disabled")
		return c, nil
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	opts.DialTimeout = 5 * time.Second
	opts.ReadTimeout = time.Second
	opts.WriteTimeout = time.Second
	opts.MaxRetries = 1
	opts.PoolTimeout = time.Second
	c.client = redis.NewClient(opts)

	c.checkHealth()
	go c.monitor()
	return c, nil
}

// monitor keeps `ready` current so a Redis outage degrades to "no cache"
// instead of adding latency to every request.
func (c *Cache) monitor() {
	t := time.NewTicker(5 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-c.stop:
			return
		case <-t.C:
			c.checkHealth()
		}
	}
}

func (c *Cache) checkHealth() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	ok := c.client.Ping(ctx).Err() == nil
	if was := c.ready.Swap(ok); was != ok {
		if ok {
			c.log.Info("redis connected, response caching enabled")
		} else {
			c.log.Warn("redis unavailable, caching disabled until reconnect")
		}
	}
}

func (c *Cache) Ready() bool { return c.client != nil && c.ready.Load() }

func (c *Cache) Ping(ctx context.Context) error {
	if c.client == nil {
		return nil
	}
	return c.client.Ping(ctx).Err()
}

func (c *Cache) Close() error {
	if c.client == nil {
		return nil
	}
	close(c.stop)
	return c.client.Close()
}

func (c *Cache) opCtx(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(parent), opTimeout)
}

func (c *Cache) logErr(err error) {
	if err != nil && !errors.Is(err, redis.Nil) {
		c.log.Error("redis operation failed", "error", err)
	}
}

// GetRaw returns the stored bytes, or nil on miss / unavailability.
func (c *Cache) GetRaw(ctx context.Context, key string) []byte {
	if !c.Ready() {
		return nil
	}
	ctx, cancel := c.opCtx(ctx)
	defer cancel()
	b, err := c.client.Get(ctx, key).Bytes()
	c.logErr(err)
	if err != nil {
		return nil
	}
	return b
}

func (c *Cache) SetRaw(ctx context.Context, key string, value []byte, ttl time.Duration) {
	if !c.Ready() {
		return
	}
	ctx, cancel := c.opCtx(ctx)
	defer cancel()
	c.logErr(c.client.Set(ctx, key, value, ttl).Err())
}

func (c *Cache) Del(ctx context.Context, keys ...string) {
	if !c.Ready() || len(keys) == 0 {
		return
	}
	ctx, cancel := c.opCtx(ctx)
	defer cancel()
	c.logErr(c.client.Del(ctx, keys...).Err())
}

// Namespace identifies a group of cached responses. Global namespaces share a
// version across users (e.g. admin user lists); responses are still keyed by
// requester so one user's response is never served to another.
type Namespace struct {
	Name   string
	Global bool
}

func NS(name string) Namespace { return Namespace{Name: name} }

func (n Namespace) scope(ctx context.Context) string {
	if n.Global {
		return "global"
	}
	return reqctx.UserID(ctx)
}

func versionKey(ns, scope string) string { return Prefix + ":ver:" + ns + ":" + scope }

// Version returns the current version of a namespace; ok=false when Redis is
// unavailable (callers must then bypass the cache).
func (c *Cache) Version(ctx context.Context, ns Namespace) (string, bool) {
	if !c.Ready() {
		return "", false
	}
	ctx, cancel := c.opCtx(ctx)
	defer cancel()
	v, err := c.client.Get(ctx, versionKey(ns.Name, ns.scope(ctx))).Result()
	if errors.Is(err, redis.Nil) {
		return "0", true
	}
	if err != nil {
		c.logErr(err)
		return "", false
	}
	return v, true
}

// Bump invalidates namespaces in one pipelined round trip.
func (c *Cache) Bump(ctx context.Context, namespaces ...Namespace) {
	if !c.Ready() || len(namespaces) == 0 {
		return
	}
	opCtx, cancel := c.opCtx(ctx)
	defer cancel()
	_, err := c.client.Pipelined(opCtx, func(p redis.Pipeliner) error {
		for _, ns := range namespaces {
			key := versionKey(ns.Name, ns.scope(ctx))
			p.Incr(opCtx, key)
			p.Expire(opCtx, key, versionTTL)
		}
		return nil
	})
	c.logErr(err)
}

/* ------------------------- authenticated user cache ------------------------ */

func userKey(id string) string { return Prefix + ":user:" + id }

func (c *Cache) GetUser(ctx context.Context, id string) *reqctx.AuthUser {
	raw := c.GetRaw(ctx, userKey(id))
	if raw == nil {
		return nil
	}
	var u reqctx.AuthUser
	if err := json.Unmarshal(raw, &u); err != nil || u.ID == "" {
		return nil
	}
	return &u
}

func (c *Cache) SetUser(ctx context.Context, u *reqctx.AuthUser) {
	if u == nil || u.ID == "" {
		return
	}
	if b, err := json.Marshal(u); err == nil {
		c.SetRaw(ctx, userKey(u.ID), b, userTTL)
	}
}

// InvalidateUser must be called after every write to a user row so changes
// such as deactivation or role updates apply on the very next request.
func (c *Cache) InvalidateUser(ctx context.Context, id string) {
	if id != "" {
		c.Del(ctx, userKey(id))
	}
}
