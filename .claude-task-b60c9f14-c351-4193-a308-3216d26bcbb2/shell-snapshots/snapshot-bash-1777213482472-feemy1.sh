# Snapshot file
# Unset all aliases to avoid conflicts with functions
unalias -a 2>/dev/null || true
shopt -s expand_aliases
# Check for rg availability
if ! (unalias rg 2>/dev/null; command -v rg) >/dev/null 2>&1; then
  function rg {
  local _cc_bin="${CLAUDE_CODE_EXECPATH:-}"
  [[ -x $_cc_bin ]] || _cc_bin=$(command -v claude 2>/dev/null)
  if [[ ! -x $_cc_bin ]]; then command rg "$@"; return; fi
  if [[ -n $ZSH_VERSION ]]; then
    ARGV0=rg "$_cc_bin" "$@"
  elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    ARGV0=rg "$_cc_bin" "$@"
  elif [[ $BASHPID != $$ ]]; then
    exec -a rg "$_cc_bin" "$@"
  else
    (exec -a rg "$_cc_bin" "$@")
  fi
}
fi
export PATH=/Users/rsiw1/rsi-agent/node_modules/.bin:/Users/rsiw1/rsi-agent/node_modules/.bin:/Users/rsiw1/node_modules/.bin:/Users/node_modules/.bin:/node_modules/.bin:/Users/rsiw1/node-v22.14.0-darwin-arm64/lib/node_modules/npm/node_modules/@npmcli/run-script/lib/node-gyp-bin:/Users/rsiw1/node-v22.14.0-darwin-arm64/bin:/Users/rsiw1/node-v22.14.0-darwin-arm64/bin:/Users/rsiw1/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/rsiw1/rsi-worktrees/11613df4/.claude-task-b60c9f14-c351-4193-a308-3216d26bcbb2/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/bin:/Users/rsiw1/rsi-worktrees/11613df4/.claude-task-b60c9f14-c351-4193-a308-3216d26bcbb2/plugins/marketplaces/claude-plugins-official/plugins/code-review/bin:/Users/rsiw1/rsi-worktrees/11613df4/.claude-task-b60c9f14-c351-4193-a308-3216d26bcbb2/plugins/marketplaces/claude-plugins-official/plugins/code-simplifier/bin:/Users/rsiw1/rsi-worktrees/11613df4/.claude-task-b60c9f14-c351-4193-a308-3216d26bcbb2/plugins/marketplaces/claude-plugins-official/plugins/feature-dev/bin:/Users/rsiw1/rsi-worktrees/11613df4/.claude-task-b60c9f14-c351-4193-a308-3216d26bcbb2/plugins/marketplaces/claude-plugins-official/plugins/typescript-lsp/bin:/Users/rsiw1/rsi-worktrees/11613df4/.claude-task-b60c9f14-c351-4193-a308-3216d26bcbb2/plugins/marketplaces/claude-plugins-official/plugins/security-guidance/bin:/Users/rsiw1/rsi-worktrees/11613df4/.claude-task-b60c9f14-c351-4193-a308-3216d26bcbb2/plugins/marketplaces/claude-plugins-official/plugins/claude-md-management/bin:/Users/rsiw1/rsi-worktrees/11613df4/.claude-task-b60c9f14-c351-4193-a308-3216d26bcbb2/plugins/marketplaces/claude-plugins-official/plugins/pr-review-toolkit/bin:/Users/rsiw1/rsi-worktrees/11613df4/.claude-task-b60c9f14-c351-4193-a308-3216d26bcbb2/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/bin
