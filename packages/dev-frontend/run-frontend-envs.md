### Start Dev Frotend on Mumbai Polygon TestNet

Add **REACT_APP_ALCHEMY_API** in .env
Run the following command from root directory

`yarn start-dev-frontend`

### Start Dev Frotend on localhost

Run Blockchain and deploy smart contracts on localhost

`yarn start-dev-chain`

#### Copy Mock Asset Addresses to SDK

Once smart contracts deployed successfully then copy `mockAsset1` and `mockAsset2` addresses from from file 
`packages\lib-ethers\deployments\default\dev.json` into the file `constants` under `packages/lib-base` and run command from `packages/lib-base`

`yarn prepare`

#### Start frontend on localhost

Switch dir to `packages/dev-frontend` and run command

`yarn start:local`





