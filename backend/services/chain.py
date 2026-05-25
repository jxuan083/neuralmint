"""Blockchain interaction service - connects to Polygon Amoy via web3.py."""

from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
import config

w3 = Web3(Web3.HTTPProvider(config.RPC_URL))

# Load ABIs
_token_abi = config.load_abi("NeuralMintToken")
_mining_abi = config.load_abi("MiningReward")
_staking_abi = config.load_abi("MinerStaking")
_amm_abi = config.load_abi("SimpleAMM")


def _get_relayer_account():
    if not config.RELAYER_PRIVATE_KEY:
        return None
    return Account.from_key(config.RELAYER_PRIVATE_KEY)


def _get_contract(address: str, abi: list):
    if not address or not abi:
        return None
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)


def get_token_contract():
    return _get_contract(config.TOKEN_ADDRESS, _token_abi)


def get_mining_contract():
    return _get_contract(config.MINING_REWARD_ADDRESS, _mining_abi)


def get_staking_contract():
    return _get_contract(config.MINER_STAKING_ADDRESS, _staking_abi)


def get_amm_contract():
    return _get_contract(config.AMM_ADDRESS, _amm_abi)


def verify_signature(address: str, message: str, signature: str) -> bool:
    """Verify an Ethereum signed message."""
    try:
        msg = encode_defunct(text=message)
        recovered = Account.recover_message(msg, signature=signature)
        return recovered.lower() == address.lower()
    except Exception:
        return False


async def get_token_balance(address: str) -> int:
    """Get NMT balance for an address (raw wei)."""
    contract = get_token_contract()
    if not contract:
        return 0
    return contract.functions.balanceOf(Web3.to_checksum_address(address)).call()


async def submit_ai_task_reward(miner_address: str, task_id_bytes: bytes) -> str | None:
    """Call MiningReward.submitAITask() to reward a miner. Returns tx hash."""
    contract = get_mining_contract()
    account = _get_relayer_account()
    if not contract or not account:
        return None

    try:
        tx = contract.functions.submitAITask(
            Web3.to_checksum_address(miner_address),
            task_id_bytes
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 200_000,
            "gasPrice": w3.eth.gas_price,
            "chainId": config.CHAIN_ID,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        return tx_hash.hex()
    except Exception as e:
        print(f"[chain] submitAITask failed: {e}")
        return None


async def set_capacity_bonus(active: bool, multiplier_bps: int = 15000) -> str | None:
    """Toggle capacity bonus when DAU/miner ratio exceeds safety threshold (2.5).
    multiplier_bps: reward multiplier in basis points (15000 = 150%)."""
    contract = get_mining_contract()
    account = _get_relayer_account()
    if not contract or not account:
        return None

    try:
        tx = contract.functions.setCapacityBonus(active, multiplier_bps).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 80_000,
            "gasPrice": w3.eth.gas_price,
            "chainId": config.CHAIN_ID,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        return tx_hash.hex()
    except Exception as e:
        print(f"[chain] setCapacityBonus failed: {e}")
        return None


async def get_token_stats() -> dict:
    """Fetch on-chain token/mining stats."""
    token = get_token_contract()
    mining = get_mining_contract()

    if not token or not mining:
        return {
            "total_supply": "0",
            "max_supply": str(21_000_000 * 10**18),
            "current_reward": str(50 * 10**18),
            "current_epoch": 0,
            "claims_until_halving": 10_000,
            "pow_difficulty": "0",
            "cost_per_task": str(35 * 10**18),
            "capacity_bonus_active": False,
        }

    total_supply = token.functions.totalSupply().call()
    max_supply = token.functions.MAX_SUPPLY().call()
    current_reward = mining.functions.currentReward().call()
    current_epoch = mining.functions.currentEpoch().call()
    claims_until = mining.functions.claimsUntilHalving().call()
    difficulty = mining.functions.difficulty().call()
    cost_per_task = mining.functions.costPerTask().call()
    pricing = mining.functions.pricingState().call()

    return {
        "total_supply": str(total_supply),
        "max_supply": str(max_supply),
        "current_reward": str(current_reward),
        "current_epoch": current_epoch,
        "claims_until_halving": claims_until,
        "pow_difficulty": str(difficulty),
        "cost_per_task": str(cost_per_task),
        "capacity_bonus_active": pricing[3],
        "capacity_bonus_multiplier_bps": pricing[4],
    }
