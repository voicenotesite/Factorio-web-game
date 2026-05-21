import { supabase } from '../../lib/supabase'
import { AuthService } from '../auth/AuthService'
import type { GameState } from '../../game/types'

export interface LobbyInfo {
  worldCode: string
  hostId: string
  worldSeed: number
  state: 'open' | 'in_game' | 'closed'
  members: { userId: string; username: string; role: 'host' | 'member' }[]
}

function generateWorldCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export class CoopLobbyService {
  static async createLobby(state: GameState): Promise<LobbyInfo> {
    const userId = AuthService.getCurrentUserId()
    if (!userId) throw new Error('Not authenticated')
    const username = AuthService.getCurrentUser() || 'Anonymous'
    const worldSeed = state.worldSeed

    let worldCode = generateWorldCode()
    let retries = 5
    while (retries > 0) {
      const { error } = await supabase.from('coop_lobbies').insert({
        world_code: worldCode,
        host_id: userId,
        world_seed: worldSeed,
      })
      if (error?.code === '23505') {
        worldCode = generateWorldCode()
        retries--
        continue
      }
      if (error) throw error
      break
    }

    await supabase.from('coop_members').insert({
      world_code: worldCode,
      user_id: userId,
      username,
      role: 'host',
    })

    return {
      worldCode,
      hostId: userId,
      worldSeed,
      state: 'open',
      members: [{ userId, username, role: 'host' }],
    }
  }

  static async joinLobby(worldCode: string): Promise<LobbyInfo> {
    const userId = AuthService.getCurrentUserId()
    if (!userId) throw new Error('Not authenticated')
    const username = AuthService.getCurrentUser() || 'Anonymous'

    const { data: lobby, error: lobbyErr } = await supabase
      .from('coop_lobbies')
      .select('*')
      .eq('world_code', worldCode)
      .single()
    if (lobbyErr || !lobby) throw new Error('World not found')
    if (lobby.state === 'closed') throw new Error('World is closed')

    const { data: existing } = await supabase
      .from('coop_members')
      .select('id')
      .eq('world_code', worldCode)
      .eq('user_id', userId)
      .single()
    if (!existing) {
      const { data: countData } = await supabase
        .from('coop_members')
        .select('id', { count: 'exact', head: true })
        .eq('world_code', worldCode)
      const count = countData?.length ?? 0
      if (count >= (lobby.max_players || 8)) throw new Error('World is full')

      await supabase.from('coop_members').insert({
        world_code: worldCode,
        user_id: userId,
        username,
        role: 'member',
      })
    }

    const { data: members } = await supabase
      .from('coop_members')
      .select('user_id, username, role')
      .eq('world_code', worldCode)

    return {
      worldCode,
      hostId: lobby.host_id,
      worldSeed: lobby.world_seed,
      state: lobby.state,
      members: (members || []).map(m => ({
        userId: m.user_id,
        username: m.username,
        role: m.role as 'host' | 'member',
      })),
    }
  }

  static async leaveLobby(worldCode: string): Promise<void> {
    const userId = AuthService.getCurrentUserId()
    if (!userId) return

    const { data: member } = await supabase
      .from('coop_members')
      .select('role')
      .eq('world_code', worldCode)
      .eq('user_id', userId)
      .single()

    if (member?.role === 'host') {
      const { data: others } = await supabase
        .from('coop_members')
        .select('user_id')
        .eq('world_code', worldCode)
        .neq('user_id', userId)
        .limit(1)

      if (others && others.length > 0) {
        await supabase.from('coop_members').update({ role: 'host' }).eq('world_code', worldCode).eq('user_id', others[0].user_id)
      } else {
        await supabase.from('coop_lobbies').delete().eq('world_code', worldCode)
      }
    }

    await supabase.from('coop_members').delete().eq('world_code', worldCode).eq('user_id', userId)
  }

  static async heartbeat(worldCode: string): Promise<void> {
    const userId = AuthService.getCurrentUserId()
    if (!userId) return
    await supabase.from('coop_members').update({ last_heartbeat: new Date().toISOString() }).eq('world_code', worldCode).eq('user_id', userId)
  }

  static async getLobbyInfo(worldCode: string): Promise<LobbyInfo | null> {
    const { data: lobby } = await supabase.from('coop_lobbies').select('*').eq('world_code', worldCode).single()
    if (!lobby) return null

    const { data: members } = await supabase.from('coop_members').select('user_id, username, role').eq('world_code', worldCode)

    return {
      worldCode,
      hostId: lobby.host_id,
      worldSeed: lobby.world_seed,
      state: lobby.state,
      members: (members || []).map(m => ({
        userId: m.user_id,
        username: m.username,
        role: m.role as 'host' | 'member',
      })),
    }
  }
}
