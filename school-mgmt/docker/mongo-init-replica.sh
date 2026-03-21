#!/bin/sh
set -eu

HOST="${MONGO_HOST:-mongo}"
PORT="${MONGO_PORT:-27017}"
REPLICA_SET="${MONGO_REPLICA_SET:-rs0}"

echo "Waiting for MongoDB at ${HOST}:${PORT}..."
until mongosh --host "$HOST" --port "$PORT" --quiet --eval "db.adminCommand({ ping: 1 }).ok" >/dev/null 2>&1; do
  sleep 2
done

echo "Ensuring replica set ${REPLICA_SET} is initialized..."
mongosh --host "$HOST" --port "$PORT" --quiet --eval "
const host = '${HOST}:${PORT}';
const replicaSet = '${REPLICA_SET}';

try {
  const status = rs.status();
  if (status.ok === 1) {
    print('Replica set already initialized.');
    quit(0);
  }
} catch (error) {
  const message = String(error);
  if (!message.includes('NotYetInitialized') && !message.includes('no replset config')) {
    throw error;
  }
}

rs.initiate({
  _id: replicaSet,
  members: [{ _id: 0, host }],
});
print('Replica set initialization requested.');
"

echo "Waiting for PRIMARY state..."
attempt=0
until mongosh --host "$HOST" --port "$PORT" --quiet --eval "
try {
  const status = rs.status();
  quit(status.myState === 1 ? 0 : 1);
} catch (error) {
  quit(1);
}
" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Mongo replica set did not become PRIMARY in time." >&2
    exit 1
  fi
  sleep 2
done

echo "Mongo replica set is ready."
