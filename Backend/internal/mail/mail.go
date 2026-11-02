// Package mail sends transactional email over SMTP.
package mail

import (
	"context"
	"errors"
	"fmt"
	"html"
	"log/slog"
	"net/url"
	"regexp"
	"time"

	gomail "github.com/wneessen/go-mail"
)

var ErrNotConfigured = errors.New("email is not configured (EMAIL_HOST missing)")

// Sender is implemented by Service; tests substitute a fake.
type Sender interface {
	SendVerification(ctx context.Context, to, firstName, token string) error
	SendPasswordReset(ctx context.Context, to, firstName, token string) error
	SendWelcome(ctx context.Context, to, firstName string) error
}

type Config struct {
	Host, User, Pass, From, AppName, ClientURL string
	Port                                       int
	LogLinks                                   bool // development only: log links when SMTP is unconfigured
}

type Service struct {
	cfg Config
	log *slog.Logger
}

func New(cfg Config, log *slog.Logger) *Service { return &Service{cfg: cfg, log: log} }

func (s *Service) send(ctx context.Context, to, subject, htmlBody string) error {
	if s.cfg.Host == "" {
		return ErrNotConfigured
	}
	msg := gomail.NewMsg()
	if err := msg.FromFormat(s.cfg.AppName, s.cfg.From); err != nil {
		return fmt.Errorf("from address: %w", err)
	}
	if err := msg.To(to); err != nil {
		return fmt.Errorf("to address: %w", err)
	}
	msg.Subject(subject)
	msg.SetBodyString(gomail.TypeTextPlain, htmlToText(htmlBody))
	msg.AddAlternativeString(gomail.TypeTextHTML, htmlBody)

	opts := []gomail.Option{gomail.WithPort(s.cfg.Port), gomail.WithTimeout(15 * time.Second)}
	if s.cfg.Port == 465 {
		opts = append(opts, gomail.WithSSLPort(false))
	} else {
		opts = append(opts, gomail.WithTLSPolicy(gomail.TLSOpportunistic))
	}
	if s.cfg.User != "" {
		opts = append(opts,
			gomail.WithSMTPAuth(gomail.SMTPAuthAutoDiscover),
			gomail.WithUsername(s.cfg.User),
			gomail.WithPassword(s.cfg.Pass),
		)
	}
	client, err := gomail.NewClient(s.cfg.Host, opts...)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		return err
	}
	s.log.Info("email sent", "to", to, "subject", subject)
	return nil
}

func (s *Service) devLink(kind, link string) {
	if s.cfg.Host == "" && s.cfg.LogLinks {
		s.log.Warn("SMTP not configured; development link", "kind", kind, "url", link)
	}
}

func (s *Service) SendVerification(ctx context.Context, to, firstName, token string) error {
	link := s.cfg.ClientURL + "/verify-email?token=" + url.QueryEscape(token)
	s.devLink("verify-email", link)
	return s.send(ctx, to, "Verify Your Email Address", verificationHTML(firstName, link))
}

func (s *Service) SendPasswordReset(ctx context.Context, to, firstName, token string) error {
	link := s.cfg.ClientURL + "/reset-password?token=" + url.QueryEscape(token)
	s.devLink("reset-password", link)
	return s.send(ctx, to, "Reset Your Password", resetHTML(firstName, link))
}

func (s *Service) SendWelcome(ctx context.Context, to, firstName string) error {
	return s.send(ctx, to, "Welcome! Your Account is Active", welcomeHTML(firstName))
}

var tagPattern = regexp.MustCompile(`<[^>]*>`)

func htmlToText(h string) string { return html.UnescapeString(tagPattern.ReplaceAllString(h, "")) }

const baseStyles = `
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { padding: 30px 20px; }
    .button { display: inline-block; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }`

func layout(title, color, heading, inner string) string {
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>` + title + `</title>
  <style>` + baseStyles + `
    .header { background: ` + color + `; color: white; padding: 20px; text-align: center; }
    .button { background: ` + color + `; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>` + heading + `</h1></div>
    <div class="content">` + inner + `</div>
    <div class="footer"><p>Best regards,<br>The Auth App Team</p></div>
  </div>
</body>
</html>`
}

func verificationHTML(firstName, link string) string {
	l := html.EscapeString(link)
	return layout("Verify Your Email", "#007bff", "Welcome to Our App!", `
      <h2>Hi `+html.EscapeString(firstName)+`,</h2>
      <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
      <div style="text-align: center;"><a href="`+l+`" class="button">Verify Email Address</a></div>
      <p>Or copy and paste this link into your browser:</p>
      <p><a href="`+l+`">`+l+`</a></p>
      <p>This link will expire in 24 hours for security reasons.</p>
      <p>If you didn't create an account, please ignore this email.</p>`)
}

func resetHTML(firstName, link string) string {
	l := html.EscapeString(link)
	return layout("Reset Your Password", "#dc3545", "Password Reset Request", `
      <h2>Hi `+html.EscapeString(firstName)+`,</h2>
      <p>You requested to reset your password. Click the button below to set a new password:</p>
      <div style="text-align: center;"><a href="`+l+`" class="button">Reset Password</a></div>
      <p>Or copy and paste this link into your browser:</p>
      <p><a href="`+l+`">`+l+`</a></p>
      <p><strong>This link will expire in 10 minutes</strong> for security reasons.</p>
      <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>`)
}

func welcomeHTML(firstName string) string {
	return layout("Welcome!", "#28a745", "Welcome to Our App!", `
      <h2>Hi `+html.EscapeString(firstName)+`,</h2>
      <p>Welcome to our platform! Your email has been successfully verified and your account is now active.</p>
      <p>You can now enjoy all the features our app has to offer.</p>
      <p>If you have any questions or need assistance, feel free to contact our support team.</p>`)
}
