# SWEVOT – Contract Deployment Guide (Sepolia ETH)

## Prerequisites
- MetaMask installed with a Sepolia wallet
- Sepolia ETH balance (get free testnet ETH from https://sepoliafaucet.com/)

---

## Step 1 — Open Remix IDE
Go to: **https://remix.ethereum.org**

## Step 2 — Create the Contract File
1. In the **File Explorer** (left panel), click the **+** icon
2. Name the file: `VotingSystem.sol`
3. Copy-paste the entire contents of `contracts/VotingSystem.sol` from this project

## Step 3 — Compile
1. Click the **Solidity Compiler** icon (left sidebar)
2. Set compiler version to **0.8.19**
3. Click **Compile VotingSystem.sol**
4. No errors should appear ✅

## Step 4 — Deploy to Sepolia
1. Click the **Deploy & Run** icon (left sidebar)
2. **Environment** → select **Injected Provider – MetaMask**
3. MetaMask will prompt you to connect → approve
4. Make sure MetaMask is on **Sepolia Test Network**
5. Under **Contract**, select **SWEVOT**
6. Click **Deploy** → confirm the transaction in MetaMask

## Step 5 — Copy Contract Address
After the transaction confirms:
1. In the **Deployed Contracts** section, expand your contract
2. Copy the **contract address** (starts with `0x...`)

## Step 6 — Paste Address into Config
Open `js/config.js` and replace:
```js
const CONTRACT_ADDRESS = 'YOUR_CONTRACT_ADDRESS_HERE';
```
with your deployed address:
```js
const CONTRACT_ADDRESS = '0xYourDeployedAddressHere';
```

## Step 7 — Done!
- Open `index.html` (which redirects to `pages/auth.html`)
- Connect your MetaMask wallet (on Sepolia)
- Register as a voter
- Your wallet is the **admin** since you deployed the contract
- Go to `pages/admin.html` to approve candidates

---

## Useful Links
- Sepolia Faucet: https://sepoliafaucet.com/
- Sepolia Etherscan: https://sepolia.etherscan.io/
- Remix IDE: https://remix.ethereum.org/
