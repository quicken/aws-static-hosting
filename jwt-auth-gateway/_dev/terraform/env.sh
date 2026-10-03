# Sourced by up.sh and down.sh. Loads the two secrets the rig needs and turns on OpenTofu state
# encryption, so the session key baked into the gate's code never sits in plain text on disk.
#
# Both secrets live in SSM Parameter Store as SecureStrings, created on first use, so they stay
# the same across runs and machines. Set SESSION_KEY or TF_STATE_PASSPHRASE yourself to skip SSM
# for that one, e.g. SESSION_KEY="$(op read op://vault/demo/session-key)".

NAME="${NAME:-trailhead-demo}"
SSM_REGION="${SSM_REGION:-us-east-1}"

if ! command -v tofu >/dev/null; then
  echo "OpenTofu (tofu) is required: state encryption is an OpenTofu feature." >&2
  exit 1
fi

# Prints the parameter's value, creating it with 32 random bytes first if it doesn't exist.
# The value goes through a private temp file, never the command line, so it can't show up in ps.
ssm_secret() {
  local name="$1" value tmp
  if value="$(aws ssm get-parameter --region "$SSM_REGION" --name "$name" --with-decryption \
      --query Parameter.Value --output text 2>/dev/null)"; then
    printf '%s' "$value"
    return
  fi
  tmp="$(mktemp)"
  chmod 600 "$tmp"
  openssl rand -base64 32 | tr -d '\n' >"$tmp"
  aws ssm put-parameter --region "$SSM_REGION" --name "$name" --type SecureString \
    --value "file://$tmp" --no-overwrite >/dev/null
  cat "$tmp"
  rm -f "$tmp"
  echo "Created SSM parameter $name in $SSM_REGION." >&2
}

SESSION_KEY="${SESSION_KEY:-$(ssm_secret "/$NAME/session-key")}"
TF_STATE_PASSPHRASE="${TF_STATE_PASSPHRASE:-$(ssm_secret "/$NAME/state-passphrase")}"
export SESSION_KEY

# enforced: refuse to ever write state or a plan unencrypted.
TF_ENCRYPTION="$(cat <<EOF
key_provider "pbkdf2" "passphrase" {
  passphrase = "$TF_STATE_PASSPHRASE"
}
method "aes_gcm" "state" {
  keys = key_provider.pbkdf2.passphrase
}
state {
  method   = method.aes_gcm.state
  enforced = true
}
plan {
  method   = method.aes_gcm.state
  enforced = true
}
EOF
)"
export TF_ENCRYPTION
unset TF_STATE_PASSPHRASE

tf() {
  tofu -chdir="$1" "${@:2}"
}
