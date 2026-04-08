# Snapshot file
# Unset all aliases to avoid conflicts with functions
unalias -a 2>/dev/null || true
shopt -s expand_aliases
# Check for rg availability
if ! (unalias rg 2>/dev/null; command -v rg) >/dev/null 2>&1; then
  alias rg='/Users/rsiw1/node-v22.14.0-darwin-arm64/lib/node_modules/\@anthropic-ai/claude-code/vendor/ripgrep/arm64-darwin/rg'
fi
export PATH=/Users/rsiw1/rsi-agent/node_modules/.bin\:/Users/rsiw1/rsi-agent/node_modules/.bin\:/Users/rsiw1/node_modules/.bin\:/Users/node_modules/.bin\:/node_modules/.bin\:/Users/rsiw1/node-v22.14.0-darwin-arm64/lib/node_modules/npm/node_modules/\@npmcli/run-script/lib/node-gyp-bin\:/Users/rsiw1/node-v22.14.0-darwin-arm64/bin\:/Users/rsiw1/node-v22.14.0-darwin-arm64/bin\:/Users/rsiw1/.local/bin\:/usr/local/bin\:/usr/bin\:/bin\:/usr/sbin\:/sbin
