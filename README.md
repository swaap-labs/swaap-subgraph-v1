<img src="https://docs.swaap.finance/img/brand.png" alt="drawing" width="300"/>


# Subgraph @ v1

## Overview

Swaap Protocol is building the first market neutral AMM. This repository contains its core smart contracts. 

For an in-depth documentation of Swaap, see our [docs](https://docs.swaap.finance/).

## Get Started

### Build
```bash
$ yarn # install all dependencies
$ yarn codegen # compile schemas
$ yarn build # build subgraph
```

### Queries

*The hosted version is available [here](https://thegraph.com/hosted-service/subgraph/swaap-labs/swaapv1).*

Protocol aggregated informations:
```graphql
{
  swaapProtocols(first: 1) {
    poolCount
    pools(first: 1, orderBy: liquidity, orderDirection: desc) {
      id
    }
    totalLiquidity
    totalSwapVolume
  }
}
```
Pool's details:
```graphql
{
  pools(first: 1, orderBy: liquidity, orderDirection: desc) {
    id
    controller
    factoryID {
      id
    }
    tokens {
      symbol
    }
    liquidity
    totalSwapVolume
    holdersCount
  }
}
```
## Licensing
This repository is largely inspired by Balancer Labs's [subgraph](https://github.com/balancer-labs/balancer-subgraph).

The source code is licensed under the MIT License: see [`LICENSE`](./LICENSE).
