import { BigInt } from "@graphprotocol/graph-ts"
import {log} from "@graphprotocol/graph-ts/"

import {
  Factory,
  LOG_NEW_POOL,
  LOG_SWAAPLABS
} from "../generated/Factory/Factory"
import { ExampleEntity } from "../generated/schema"

export function handleLOG_NEW_POOL(event: LOG_NEW_POOL): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  log.info("SWAAP : Found new pool", [])
  let entity = ExampleEntity.load(event.transaction.from.toHex())

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (!entity) {
    entity = new ExampleEntity(event.transaction.from.toHex())

    // Entity fields can be set using simple assignments
    entity.count = BigInt.fromI32(0)
  }

  // BigInt and BigDecimal math are supported
  entity.count = entity.count.plus(BigInt.fromI32(1))

  // Entity fields can be set based on event parameters
  entity.caller = event.params.caller
  entity.pool = event.params.pool

  // Entities can be written to the store with `.save()`
  log.info("SWAAP : Saving new pool", [])

  entity.save()

  log.info("SWAAP : Saved new pool", [])


  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // - contract.isPool(...)
  // - contract.newPool(...)
  // - contract.getSwaapLabs(...)
}

export function handleLOG_SWAAPLABS(event: LOG_SWAAPLABS): void {}
