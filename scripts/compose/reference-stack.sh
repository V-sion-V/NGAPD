#!/bin/sh

set -eu

usage() {
  cat <<'EOF'
Usage: reference-stack.sh <up|smoke|down>

Required environment:
  NGAPD_REFERENCE_PROJECT   Run-unique Compose project beginning with ngapd-reference-
  NGAPD_REFERENCE_ENV_FILE Absolute path to a shell-compatible Compose env file

Optional environment:
  NGAPD_REFERENCE_SOURCE         Repository root; defaults to this script's repository
  NGAPD_REFERENCE_GATEWAY_HOST   Address used by curl; defaults to 127.0.0.1
  NGAPD_REFERENCE_REMOVE_IMAGES  Set to 1 to remove this project's built images on down
EOF
}

if [ "$#" -ne 1 ]; then
  usage >&2
  exit 64
fi

command_name=$1
script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
repository_root=${NGAPD_REFERENCE_SOURCE:-$(CDPATH= cd "$script_dir/../.." && pwd)}
project=${NGAPD_REFERENCE_PROJECT:-}
env_file=${NGAPD_REFERENCE_ENV_FILE:-}
gateway_host=${NGAPD_REFERENCE_GATEWAY_HOST:-127.0.0.1}

case "$project" in
  ngapd-reference-[a-z0-9-]*) ;;
  *)
    echo "NGAPD_REFERENCE_PROJECT must begin with ngapd-reference- and be run-unique" >&2
    exit 65
    ;;
esac

if [ -z "$env_file" ] || [ "${env_file#/}" = "$env_file" ] || [ ! -f "$env_file" ]; then
  echo "NGAPD_REFERENCE_ENV_FILE must name an existing absolute file" >&2
  exit 66
fi

if [ ! -f "$repository_root/compose.yaml" ]; then
  echo "NGAPD_REFERENCE_SOURCE must contain compose.yaml" >&2
  exit 67
fi

compose() {
  docker compose \
    --project-name "$project" \
    --file "$repository_root/compose.yaml" \
    --env-file "$env_file" \
    "$@"
}

expect_contains() {
  actual=$1
  expected=$2
  label=$3
  case "$actual" in
    *"$expected"*) ;;
    *)
      echo "REFERENCE_ASSERTION_FAILED=$label" >&2
      exit 80
      ;;
  esac
}

load_reference_environment() {
  set -a
  # The runbook requires shell-compatible values without whitespace.
  # shellcheck disable=SC1090
  . "$env_file"
  set +a

  POSTGRES_DB=${POSTGRES_DB:-ngapd}
  POSTGRES_USER=${POSTGRES_USER:-ngapd}
  NGAPD_HTTPS_PORT=${NGAPD_HTTPS_PORT:-8443}
  if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo "POSTGRES_PASSWORD is required" >&2
    exit 68
  fi
}

up_stack() {
  services=$(compose config --services | sort | tr '\n' ' ')
  if [ "$services" != "api gateway migrate postgres web worker " ]; then
    echo "REFERENCE_ASSERTION_FAILED=service_inventory:$services" >&2
    exit 79
  fi
  compose build --pull
  compose up --detach --wait --wait-timeout 240
}

smoke_stack() {
  load_reference_environment

  live=$(curl --fail --silent --show-error --insecure \
    --resolve "ngapd.local:${NGAPD_HTTPS_PORT}:${gateway_host}" \
    "https://ngapd.local:${NGAPD_HTTPS_PORT}/health/live")
  ready=$(curl --fail --silent --show-error --insecure \
    --resolve "ngapd.local:${NGAPD_HTTPS_PORT}:${gateway_host}" \
    "https://ngapd.local:${NGAPD_HTTPS_PORT}/health/ready")
  web=$(curl --fail --silent --show-error --insecure \
    --resolve "ngapd.local:${NGAPD_HTTPS_PORT}:${gateway_host}" \
    "https://ngapd.local:${NGAPD_HTTPS_PORT}/")
  expect_contains "$live" '"status":"ok"' gateway_live
  expect_contains "$ready" '"status":"ok"' gateway_ready
  expect_contains "$web" 'id="root"' gateway_web

  compose exec -T worker node -e \
    "fetch('http://127.0.0.1:3001/health/live').then(r=>{if(!r.ok)process.exit(1)})"
  compose exec -T worker node -e \
    "fetch('http://127.0.0.1:3001/health/ready').then(r=>{if(!r.ok)process.exit(1)})"
  compose run --rm migrate

  for service in api worker web gateway; do
    uid=$(compose exec -T "$service" id -u)
    if [ -z "$uid" ] || [ "$uid" = 0 ]; then
      echo "REFERENCE_ASSERTION_FAILED=${service}_non_root" >&2
      exit 81
    fi
    readonly_root=$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' \
      "${project}-${service}-1")
    if [ "$readonly_root" != true ]; then
      echo "REFERENCE_ASSERTION_FAILED=${service}_readonly_root" >&2
      exit 82
    fi
  done

  api_ports=$(compose port api 3000 2>/dev/null || true)
  worker_ports=$(compose port worker 3001 2>/dev/null || true)
  if [ -n "$api_ports" ] || [ -n "$worker_ports" ]; then
    echo "REFERENCE_ASSERTION_FAILED=application_host_ports" >&2
    exit 83
  fi

  api_networks=$(docker inspect \
    --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' \
    "${project}-api-1")
  worker_networks=$(docker inspect \
    --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' \
    "${project}-worker-1")
  expect_contains "$api_networks" "${project}_backend" api_backend_network
  expect_contains "$worker_networks" "${project}_backend" worker_backend_network
  case "$api_networks $worker_networks" in
    *"${project}_edge"*)
      echo "REFERENCE_ASSERTION_FAILED=application_edge_network" >&2
      exit 84
      ;;
  esac

  compose exec -T api node --input-type=module --eval \
    "const fs = await import('node:fs/promises'); await fs.writeFile('/var/lib/ngapd/objects/reference-marker', 'objects'); await fs.writeFile('/var/lib/ngapd/backups/reference-marker', 'backups');"
  compose restart api
  compose up --detach --wait --wait-timeout 180
  compose exec -T api node --input-type=module --eval \
    "const fs = await import('node:fs/promises'); if ((await fs.readFile('/var/lib/ngapd/objects/reference-marker', 'utf8')) !== 'objects') process.exit(1); if ((await fs.readFile('/var/lib/ngapd/backups/reference-marker', 'utf8')) !== 'backups') process.exit(1);"

  for service in api worker; do
    compose exec -T "$service" node --input-type=module --eval \
      "try { await fetch('https://example.com', { signal: AbortSignal.timeout(3000) }); process.exit(1); } catch { process.exit(0); }"
  done

  if compose logs --no-color 2>&1 | grep -Fq "$POSTGRES_PASSWORD"; then
    echo "REFERENCE_ASSERTION_FAILED=password_in_logs" >&2
    exit 85
  fi

  profile=$(compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
    "select key || '=' || value from system_metadata where key in ('schema_profile','schema_profile_version') order by key")
  migrations=$(compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F '|' -c \
    'select count(*), max(name) from kysely_migration')
  templates=$(compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
    'select count(*) from system_logical_role_templates')

  echo "GATEWAY_LIVE=ok"
  echo "GATEWAY_READY=ok"
  echo "WEB_ROOT=ok"
  echo "WORKER_HEALTH=ok"
  echo "NON_ROOT_READONLY=ok"
  echo "APPLICATION_HOST_PORTS=none"
  echo "APPLICATION_EGRESS=blocked"
  echo "PERSISTENT_VOLUMES=verified"
  echo "SCHEMA_PROFILE=$(printf '%s' "$profile" | tr '\n' '|')"
  echo "MIGRATIONS=$migrations"
  echo "SYSTEM_TEMPLATES=$templates"
  echo "REFERENCE_SMOKE_RESULT=passed"
}

down_stack() {
  compose down --volumes --remove-orphans --timeout 20

  remaining=$(compose ps --all --quiet)
  if [ -n "$remaining" ]; then
    echo "REFERENCE_CLEANUP_FAILED=containers_remain" >&2
    exit 86
  fi
  remaining_networks=$(docker network ls --quiet \
    --filter "label=com.docker.compose.project=$project")
  remaining_volumes=$(docker volume ls --quiet \
    --filter "label=com.docker.compose.project=$project")
  if [ -n "$remaining_networks" ] || [ -n "$remaining_volumes" ]; then
    echo "REFERENCE_CLEANUP_FAILED=networks_or_volumes_remain" >&2
    exit 87
  fi

  if [ "${NGAPD_REFERENCE_REMOVE_IMAGES:-0}" = 1 ]; then
    for service in api gateway migrate web worker; do
      image="${project}-${service}:latest"
      if docker image inspect "$image" >/dev/null 2>&1; then
        docker image rm "$image"
      fi
    done
    remaining_images=$(docker image ls --quiet --filter "reference=${project}-*")
    if [ -n "$remaining_images" ]; then
      echo "REFERENCE_CLEANUP_FAILED=images_remain" >&2
      exit 88
    fi
  fi

  echo "REFERENCE_CLEANUP_RESULT=passed"
}

case "$command_name" in
  up) up_stack ;;
  smoke) smoke_stack ;;
  down) down_stack ;;
  *)
    usage >&2
    exit 64
    ;;
esac
