#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "${script_dir}/.." && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
install_root="${CODEX_HOME:-$HOME/.codex}/skills"
target="${install_root}/gotenks"
bundled_humanizer_source="${repo_root}/humanizer-main"
fallback_humanizer_source="${HOME}/.agents/skills/humanizer"
humanizer_target="${install_root}/humanizer"

mkdir -p "${install_root}"

if [[ -e "${target}" && ! -L "${target}" ]]; then
  resolved_target="$(cd "${target}" && pwd -P)"
  resolved_skill="$(cd "${skill_dir}" && pwd -P)"
  if [[ "${resolved_target}" != "${resolved_skill}" ]]; then
    echo "Refusing to replace existing non-symlink path: ${target}" >&2
    exit 1
  fi
fi

ln -sfn "${skill_dir}" "${target}"
echo "Installed ${target} -> ${skill_dir}"

if [[ -d "${bundled_humanizer_source}" ]]; then
  ln -sfn "${bundled_humanizer_source}" "${humanizer_target}"
  echo "Installed ${humanizer_target} -> ${bundled_humanizer_source}"
elif [[ -d "${fallback_humanizer_source}" ]]; then
  ln -sfn "${fallback_humanizer_source}" "${humanizer_target}"
  echo "Installed ${humanizer_target} -> ${fallback_humanizer_source}"
else
  echo "Humanizer skill not found in the repo or at ${fallback_humanizer_source}; install it separately if you want the final humanizer pass." >&2
fi
