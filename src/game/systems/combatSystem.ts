/**
 * Combat System
 * Handles all combat-related logic: damage, projectiles, attacks
 */
import type { Player, Monster, DefenseBuilding, Projectile, VanguardUnit, Vector2 } from '../../types/game'
import { GAME_CONSTANTS } from '../../types/game'
import { distance, moveTowards, gridToWorld } from '../../composables/usePathfinding'

// =============================================================================
// DAMAGE CALCULATION
// =============================================================================
export function getBuildingDamage(baseDamage: number, level: number): number {
  return Math.floor(baseDamage * Math.pow(GAME_CONSTANTS.BUILDING_DAMAGE_SCALE, level - 1))
}

export function getBuildingRange(baseRange: number, level: number): number {
  return Math.floor(baseRange * Math.pow(GAME_CONSTANTS.BUILDING_RANGE_SCALE, level - 1))
}

export function getMonsterDamage(baseDamage: number, level: number): number {
  return Math.floor(baseDamage * Math.pow(GAME_CONSTANTS.MONSTER_DAMAGE_SCALE, level - 1))
}

export function getMonsterMaxHp(baseHp: number, level: number): number {
  return Math.floor(baseHp * Math.pow(GAME_CONSTANTS.MONSTER_HP_SCALE, level - 1))
}

export function getVanguardHp(level: number): number {
  return Math.floor(GAME_CONSTANTS.VANGUARD.BASE_HP * Math.pow(GAME_CONSTANTS.VANGUARD.HP_SCALE, level - 1))
}

export function getVanguardDamage(level: number): number {
  return Math.floor(GAME_CONSTANTS.VANGUARD.BASE_DAMAGE * Math.pow(GAME_CONSTANTS.VANGUARD.DAMAGE_SCALE, level - 1))
}

// =============================================================================
// TURRET ATTACK
// =============================================================================
export interface TurretAttackResult {
  projectile: Projectile | null
  playSound: boolean
}

export function processTurretAttack(
  building: DefenseBuilding,
  monster: Monster,
  deltaTime: number
): TurretAttackResult {
  if (building.type !== 'turret' || building.hp <= 0) {
    return { projectile: null, playSound: false }
  }
  
  // Update cooldown
  if (building.currentCooldown > 0) {
    building.currentCooldown -= deltaTime
  }
  
  const buildingPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
  const actualDamage = getBuildingDamage(building.baseDamage, building.level)
  const actualRange = getBuildingRange(building.baseRange, building.level)
  const distToMonster = distance(buildingPos, monster.position)
  
  if (distToMonster < actualRange && monster.hp > 0) {
    // Rotate turret toward monster
    const dx = monster.position.x - buildingPos.x
    const dy = monster.position.y - buildingPos.y
    building.rotation = Math.atan2(dy, dx)
    
    if (building.currentCooldown <= 0) {
      building.currentCooldown = building.cooldown
      
      return {
        projectile: {
          position: { ...buildingPos },
          target: { ...monster.position },
          speed: 500,
          damage: actualDamage,
          ownerId: building.ownerId,
          color: '#3b82f6',
          size: 5,
          isHoming: true,
        },
        playSound: true,
      }
    }
  }
  
  return { projectile: null, playSound: false }
}

// =============================================================================
// PROJECTILE UPDATE
// =============================================================================
export interface ProjectileUpdateResult {
  damage: number
  hitPosition: Vector2 | null
  remove: boolean
}

export function updateProjectile(
  projectile: Projectile,
  monster: Monster,
  deltaTime: number
): ProjectileUpdateResult {
  // Homing projectiles track monster position
  if (projectile.isHoming && monster.hp > 0) {
    projectile.target.x = monster.position.x
    projectile.target.y = monster.position.y
  }
  
  const moved = moveTowards(projectile.position, projectile.target, projectile.speed, deltaTime)
  projectile.position.x = moved.x
  projectile.position.y = moved.y
  
  // Hit detection
  if (distance(projectile.position, monster.position) < 40) {
    return {
      damage: projectile.damage,
      hitPosition: { ...projectile.position },
      remove: true,
    }
  }
  
  // Non-homing projectiles disappear at target
  if (!projectile.isHoming && distance(projectile.position, projectile.target) < 10) {
    return { damage: 0, hitPosition: null, remove: true }
  }
  
  return { damage: 0, hitPosition: null, remove: false }
}

// =============================================================================
// VANGUARD COMBAT
// =============================================================================
export function processVanguardAttack(
  vanguard: VanguardUnit,
  monster: Monster,
  deltaTime: number
): { damage: number; playSound: boolean } {
  if (vanguard.state !== 'attacking' || vanguard.hp <= 0) {
    return { damage: 0, playSound: false }
  }
  
  // Update cooldown
  if (vanguard.attackCooldown > 0) {
    vanguard.attackCooldown -= deltaTime
    return { damage: 0, playSound: false }
  }
  
  const distToMonster = distance(vanguard.position, monster.position)
  if (distToMonster < GAME_CONSTANTS.VANGUARD.ATTACK_RANGE && monster.hp > 0) {
    vanguard.attackCooldown = GAME_CONSTANTS.VANGUARD.ATTACK_COOLDOWN
    return { damage: vanguard.damage, playSound: true }
  }
  
  return { damage: 0, playSound: false }
}

// =============================================================================
// MONSTER ATTACK
// =============================================================================
export function processMonsterAttack(
  monster: Monster,
  target: { position: Vector2; hp: number },
  deltaTime: number
): { damage: number; playSound: boolean } {
  if (monster.state !== 'attacking' || monster.hp <= 0) {
    return { damage: 0, playSound: false }
  }
  
  if (monster.attackCooldown > 0) {
    monster.attackCooldown -= deltaTime
    return { damage: 0, playSound: false }
  }
  
  const distToTarget = distance(monster.position, target.position)
  if (distToTarget < monster.attackRange && target.hp > 0) {
    monster.attackCooldown = GAME_CONSTANTS.MONSTER_ATTACK_SPEED
    return { damage: monster.damage, playSound: true }
  }
  
  return { damage: 0, playSound: false }
}

// =============================================================================
// PLAYER ATTACK
// =============================================================================
export function processPlayerAttack(
  player: Player,
  monster: Monster,
  deltaTime: number
): { damage: number; playSound: boolean } {
  if (!player.alive || player.isSleeping || player.state !== 'attacking') {
    return { damage: 0, playSound: false }
  }
  
  if (player.attackCooldown > 0) {
    player.attackCooldown -= deltaTime
    return { damage: 0, playSound: false }
  }
  
  const distToMonster = distance(player.position, monster.position)
  if (distToMonster < player.attackRange && monster.hp > 0) {
    player.attackCooldown = GAME_CONSTANTS.ATTACK_COOLDOWN
    return { damage: player.damage, playSound: true }
  }
  
  return { damage: 0, playSound: false }
}
