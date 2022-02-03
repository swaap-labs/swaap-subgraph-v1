## Note on npm vs yarn

It looks like `npm` has difficulties to get good dependencies compared to `yarn`.


### Generate code


```shell
npx graph codegen
```


```shell
npx graph deploy --product hosted-service nicolas-zozol/nik1
```


## Elements on Testnet Rinkeby

Original contract:

We should see the Factory : [0x24bbB5FB62611C2ed75a4b7f9E0cbB88239EA736](https://rinkeby.etherscan.io/address/0x24bbb5fb62611c2ed75a4b7f9e0cbb88239ea736#events)
And the original Pool : [0x4de491a0a8F2A7689a22Af589d6f920e968Df143](https://rinkeby.etherscan.io/address/0x4de491a0a8f2a7689a22af589d6f920e968df143#events)

New contract:

factoryContractAddress: "0x1958AE4a8De1D8E1D649B8DEB21A00876dd722Bb",
poolContractAddress: "0x5e988f6549e3405Ea1F443917A7Ef1Cf965A4e5B",


The pool is created from a template and should be able to have its swaps logged