#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/../.." && pwd)
environment_file="$repository_root/.env.local"
output_file="$script_dir/Local.xcconfig"

if [ ! -f "$environment_file" ]; then
    printf '%s\n' "Missing $environment_file."
    exit 1
fi

anon_key=$(sed -n 's/^NEXT_PUBLIC_INSFORGE_ANON_KEY=//p' "$environment_file" | tail -n 1)

if [ -z "$anon_key" ]; then
    printf '%s\n' "NEXT_PUBLIC_INSFORGE_ANON_KEY is missing from $environment_file."
    exit 1
fi

umask 077
printf '%s\n' \
    "// Generated from .env.local. Do not commit this file." \
    "INSFORGE_ANON_KEY = $anon_key" > "$output_file"

printf '%s\n' "Updated ios/Config/Local.xcconfig."
