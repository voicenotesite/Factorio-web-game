import { GameState } from '../../game/types'
import { getTileAt } from './chunk'
import { addItemToBuilding, removeItemFromBuilding, removeItemFromBuildingOutput, getAcceptedItemTypes, DIR_OFFSETS } from './helpers'

export function updateConveyors(state: GameState) {
  // Conveyory co 3 ticki — przedmioty nie potrzebują 60Hz update
  if (state.tick % 3 !== 0) return
  for (const [, inserter] of state.buildings) {
    if (inserter.type !== 'inserter') continue
    inserter.progress = (inserter.progress || 0) + 1
    if (inserter.progress < 20) continue
    inserter.progress = 0

    const dir = DIR_OFFSETS[inserter.direction] || DIR_OFFSETS.right
    const srcX = inserter.x - dir.dx
    const srcY = inserter.y - dir.dy
    const dstX = inserter.x + dir.dx
    const dstY = inserter.y + dir.dy

    const srcKey = `${srcX},${srcY}`
    const srcBuilding = getTileAt(state, srcX, srcY).building || null
    const srcConveyor = state.conveyors.get(srcKey)
    const dstBuilding = getTileAt(state, dstX, dstY).building || null
    const dstConveyor = state.conveyors.get(`${dstX},${dstY}`)

    let pickedItem: string | null = null

    if (srcConveyor) {
      for (const seg of srcConveyor) {
        if (seg.itemId) {
          pickedItem = seg.itemId
          seg.itemId = null
          seg.progress = 0
          break
        }
      }
    }

    if (!pickedItem && srcBuilding) {
      if (srcBuilding.outputInventory.length > 0) {
        const item = srcBuilding.outputInventory[0]
        if (item && item.count > 0) {
          pickedItem = item.itemId
          removeItemFromBuildingOutput(srcBuilding, item.itemId, 1)
        }
      } else if (srcBuilding.inventory.length > 0 && srcBuilding.type === 'storage') {
        const item = srcBuilding.inventory[0]
        if (item && item.count > 0) {
          pickedItem = item.itemId
          removeItemFromBuilding(srcBuilding, item.itemId, 1)
        }
      }
    }

    if (!pickedItem) continue

    if (dstConveyor) {
      for (const seg of dstConveyor) {
        if (!seg.itemId) {
          seg.itemId = pickedItem
          seg.progress = 0
          pickedItem = null
          break
        }
      }
    }
    if (pickedItem && dstBuilding) {
      addItemToBuilding(dstBuilding, pickedItem, 1)
    }
  }

  for (const [key, segments] of state.conveyors) {
    const building = state.buildings.get(key)
    if (!building) continue

    const dir = DIR_OFFSETS[building.direction] || DIR_OFFSETS.right

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (!seg.itemId) continue

      seg.progress += 0.025

      if (seg.progress >= 1) {
        const nx = building.x + dir.dx
        const ny = building.y + dir.dy
        const nextKey = `${nx},${ny}`
        const nextConveyor = state.conveyors.get(nextKey)
        const nextBuilding = state.buildings.get(nextKey) || getTileAt(state, nx, ny).building || null

        let transferred = false

        if (nextConveyor) {
          for (const nextSeg of nextConveyor) {
            if (!nextSeg.itemId) {
              nextSeg.itemId = seg.itemId
              nextSeg.progress = 0
              seg.itemId = null
              seg.progress = i === 0 ? 0 : 0.5
              transferred = true
              break
            }
          }
        }

        if (!transferred && nextBuilding) {
          const acceptedTypes = getAcceptedItemTypes(nextBuilding.type)
          if (acceptedTypes === 'any' || acceptedTypes.includes(seg.itemId!)) {
            addItemToBuilding(nextBuilding, seg.itemId!, 1)
            seg.itemId = null
            seg.progress = i === 0 ? 0 : 0.5
            transferred = true
          }
        }

        if (!transferred) {
          seg.progress = 1
        }
      }
    }
  }

  for (const [key, building] of state.buildings) {
    if (building.type !== 'underground_belt') continue
    const segments = state.conveyors.get(key)
    if (!segments) continue
    const dir = DIR_OFFSETS[building.direction] || DIR_OFFSETS.right
    for (let dist = 2; dist <= 5; dist++) {
      const exitX = building.x + dir.dx * dist
      const exitY = building.y + dir.dy * dist
      const exitKey = `${exitX},${exitY}`
      const exitBuilding = state.buildings.get(exitKey)
      if (!exitBuilding || exitBuilding.type !== 'underground_belt') continue
      if (exitBuilding.direction !== building.direction) continue
      const exitSegments = state.conveyors.get(exitKey)
      if (!exitSegments) continue
      for (const seg of segments) {
        if (seg.itemId && seg.progress >= 1) {
          for (const exitSeg of exitSegments) {
            if (!exitSeg.itemId) {
              exitSeg.itemId = seg.itemId
              exitSeg.progress = 0
              seg.itemId = null
              seg.progress = 0
              break
            }
          }
        }
      }
      break
    }
  }

  for (const [key, building] of state.buildings) {
    if (building.type !== 'splitter') continue
    const segments = state.conveyors.get(key)
    if (!segments) continue
    const dir = DIR_OFFSETS[building.direction] || DIR_OFFSETS.right
    for (const seg of segments) {
      if (!seg.itemId || seg.progress < 1) continue
      const leftDx = -dir.dy, leftDy = dir.dx
      const rightDx = dir.dy, rightDy = -dir.dx
      const outputs = [
        { x: building.x + dir.dx + leftDx, y: building.y + dir.dy + leftDy },
        { x: building.x + dir.dx + rightDx, y: building.y + dir.dy + rightDy },
        { x: building.x + dir.dx, y: building.y + dir.dy },
      ]
      let transferred = false
      for (const out of outputs) {
        const outKey = `${out.x},${out.y}`
        const outConveyor = state.conveyors.get(outKey)
        if (outConveyor) {
          for (const outSeg of outConveyor) {
            if (!outSeg.itemId) {
              outSeg.itemId = seg.itemId
              outSeg.progress = 0
              seg.itemId = null
              seg.progress = 0
              transferred = true
              break
            }
          }
        }
        if (transferred) break
      }
      if (!transferred) seg.progress = 1
    }
  }
}
