"""
This application uses the official Riot Games API to retrieve League of Legends statistics and authenticate users via Riot ID.

API Provider:
- Riot Games, Inc.
- Developer Portal: https://developer.riotgames.com
- API Documentation: https://developer.riotgames.com/apis

League of Legends data, Riot IDs, and related game information
are provided by Riot Games. This project is not endorsed by or
affiliated with Riot Games.

All Riot Games trademarks and assets are the property of Riot Games, Inc.
"""

from fastapi import APIRouter, HTTPException
import httpx #type:ignore
import os
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/riot", tags=["riot"])

# Prefer backend environment variable, allow VITE fallback for local dev
RIOT_API_KEY = os.getenv("RIOT_API_KEY") or os.getenv("VITE_RIOT_API_KEY")


# ---------- Helper Functions ----------

def riot_headers() -> Dict[str, str]:
    """
    Build request headers for Riot API calls.

    Raises:
        HTTPException: If API key is not configured.

    Returns:
        dict: Headers containing the Riot API token.
    """
    if not RIOT_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Riot API key not configured (set RIOT_API_KEY on server).",
        )
        
    return {"X-Riot-Token": RIOT_API_KEY}


async def riot_get(url: str, params: Optional[dict] = None) -> Any:
    """
    Perform a GET request to the Riot API with proper headers and error handling.

    Args:
        url (str): Riot API endpoint URL.
        params (dict, optional): Query parameters.

    Raises:
        HTTPException: If the Riot API returns an error.

    Returns:
        Any: Parsed JSON response from Riot API.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=riot_headers(), params=params)

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Unauthorized: invalid Riot API key")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Riot API error: {response.text}",
        )

    return response.json()


# ---------- Routes ----------

@router.get("/account/{region}/{game_name}/{tag_line}")
async def get_account_by_riot_id(region: str, game_name: str, tag_line: str):
    """
    Retrieve account information (PUUID) using Riot ID.

    Args:
        region (str): Riot routing region (e.g. americas, europe, asia).
        game_name (str): Riot in-game name.
        tag_line (str): Riot tagline (e.g. EUW).

    Returns:
        dict: Riot account information including PUUID.
    """
    url = f"https://{region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
    return await riot_get(url)


@router.get("/summoner/{platform}/{puuid}")
async def get_summoner_by_puuid(platform: str, puuid: str):
    """
    Retrieve summoner profile data using PUUID.

    Args:
        platform (str): Platform shard (e.g. euw1, na1).
        puuid (str): Player universal unique ID.

    Returns:
        dict: Summoner profile data.
    """
    url = f"https://{platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}"
    return await riot_get(url)


@router.get("/ranked-by-puuid/{platform}/{puuid}")
async def get_ranked_stats_by_puuid(platform: str, puuid: str):
    """
    Retrieve ranked statistics for a player using PUUID.

    Args:
        platform (str): Platform shard.
        puuid (str): Player PUUID.

    Returns:
        list: Ranked queue entries for the player.
    """
    url = f"https://{platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}"
    return await riot_get(url)


@router.get("/matches/{region}/{puuid}")
async def get_match_ids(
    region: str,
    puuid: str,
    count: int = 20,
    startTime: Optional[int] = None,
    endTime: Optional[int] = None,
    matchType: Optional[str] = None,
):
    """
    Retrieve recent match IDs for a player.

    Args:
        region (str): Regional routing value.
        puuid (str): Player PUUID.
        count (int): Number of matches to fetch.
        startTime (int, optional): Start time in epoch (ms or seconds).
        endTime (int, optional): End time in epoch (ms or seconds).
        matchType (str, optional): Filter by match type.

    Returns:
        list[str]: List of match IDs.
    """
    url = f"https://{region}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids"

    params = {"start": 0, "count": count}
    if matchType:
        params["type"] = matchType #type:ignore
    if startTime is not None:
        params["startTime"] = startTime
    if endTime is not None:
        params["endTime"] = endTime

    match_ids = await riot_get(url, params)

    # Retry using seconds if milliseconds were passed
    if (
        isinstance(match_ids, list)
        and len(match_ids) == 0
        and startTime is not None
        and endTime is not None
        and startTime > 1_000_000_000_000
    ):
        retry_params = params.copy()
        retry_params["startTime"] = startTime // 1000
        retry_params["endTime"] = endTime // 1000
        return await riot_get(url, retry_params)

    return match_ids


@router.get("/match/{region}/{match_id}")
async def get_match_details(region: str, match_id: str):
    """
    Retrieve detailed information about a specific match.

    Args:
        region (str): Regional routing value.
        match_id (str): Riot match ID.

    Returns:
        dict: Match details payload.
    """
    url = f"https://{region}.api.riotgames.com/lol/match/v5/matches/{match_id}"
    return await riot_get(url)


@router.get("/mastery/{platform}/{puuid}")
async def get_champion_mastery(platform: str, puuid: str, count: int = 4):
    """
    Retrieve top champion mastery entries for a player.

    Args:
        platform (str): Platform shard.
        puuid (str): Player PUUID.
        count (int): Number of champions to return.

    Returns:
        list: Champion mastery entries.
    """
    url = f"https://{platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top"
    return await riot_get(url, params={"count": count})