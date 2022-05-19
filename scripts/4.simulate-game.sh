#!/usr/bin/env bash

# exit on first error after this point to avoid redeploying with successful build
set -e
echo
echo ---------------------------------------------------------
echo "Create and join a game"
echo ---------------------------------------------------------
echo

# Update contract ID after deploying contract
export CONTRACT=dev-1652964929956-58391803779828
export P1=johnonym.testnet
export P2=dev-1652964929956-58391803779828
[ -z "$CONTRACT" ] && echo "Missing \$CONTRACT environment variable" && exit 1
[ -z "$CONTRACT" ] || echo "Found it! \$CONTRACT is set to [ $CONTRACT ]"

near call $CONTRACT createGame '{}' --accountId $P1
near call $CONTRACT joinGame '{"gameId":'\""${P1}"\"'}' --accountId $P2
near call $CONTRACT hasPlayer2Joined  '{"gameId":'\""${P1}"\"'}' --accountId $P1
near call $CONTRACT getOtherPlayersNextCommand  '{"gameId":'\""${P1}"\"'}' --accountId $P1
near call $CONTRACT getOtherPlayersNextCommand  '{"gameId":'\""${P1}"\"'}' --accountId $P2

echo
echo

# near view $CONTRACT read '{"key":"some-key"}'

echo
echo
echo ---------------------------------------------------------
echo "Step 2: Call 'change' functions on the contract"
echo ---------------------------------------------------------
echo

# the following line fails with an error because we can't write to storage without signing the message
# --> FunctionCallError(HostError(ProhibitedInView { method_name: "storage_write" }))
# near view $CONTRACT write '{"key": "some-key", "value":"some value"}'
# near call $CONTRACT write '{"key": "some-key", "value":"some value"}' --accountId $CONTRACT
exit 0
