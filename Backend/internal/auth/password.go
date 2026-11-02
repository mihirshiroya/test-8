package auth

import "golang.org/x/crypto/bcrypt"

// bcrypt only uses the first 72 bytes of a password. bcryptjs (used by the
// Node backend) silently truncated longer inputs, while Go's bcrypt rejects
// them, so truncate explicitly to keep existing hashes verifiable.
const bcryptMaxBytes = 72

func clip(password string) []byte {
	b := []byte(password)
	if len(b) > bcryptMaxBytes {
		b = b[:bcryptMaxBytes]
	}
	return b
}

func HashPassword(password string, cost int) (string, error) {
	h, err := bcrypt.GenerateFromPassword(clip(password), cost)
	return string(h), err
}

// ComparePassword is constant-time and returns false for a missing hash.
func ComparePassword(hash *string, password string) bool {
	if hash == nil || *hash == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(*hash), clip(password)) == nil
}
