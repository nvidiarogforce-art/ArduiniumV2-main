import { useState } from 'react'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { useT } from '../i18n/index.js'
import {
  BLOCK_TYPES,
  COMPARE_OPS,
  CONTAINER_TYPES,
  DIRECTIONS,
  MATH_OPS,
  OPERAND_SOURCES,
  duplicateBlock,
  findBlock,
  insertBlock,
  makeBlock,
  moveBlock,
  removeBlock,
  updateBlock,
} from '../lib/program.js'
import { DIGITAL_HEADER } from '../lib/config.js'
import { sfx } from '../lib/sfx.js'

/**
 * Every pin a block may address: the full digital header, minus D0/D1 (the
 * serial lines on a real Uno). The old list was just the five socket pins,
 * which could not even display the rover's own sensor pins (D6/D7 in the
 * template) — a block on pin 7 rendered a <select> with no matching option, so
 * the browser showed "pin 13" while the block was really on 7.
 */
const BLOCK_PINS = DIGITAL_HEADER.filter((d) => d.pin != null && d.pin >= 2)
  .map((d) => d.pin)
  .sort((a, b) => b - a)

/**
 * The block editor.
 *
 * Order matters here. `Drive` sits first and is the widest block, because it
 * is the one that actually makes the robot go — an earlier version put raw
 * pin writes first and a `Print` block that only wrote text, and testers
 * reasonably assumed editing that text would steer the robot. A palette should
 * never make a label look like a command.
 */
export default function ProgramEditor() {
  const program = useBuildStore((s) => s.program)
  const setProgram = useBuildStore((s) => s.setProgram)
  const pinMap = useBuildStore((s) => s.pinMap)()
  const say = useUiStore((s) => s.say)
  const t = useT()
  const [target, setTarget] = useState({ id: null, slot: 'body', label: null })
  /*
   * The block being dragged, and where it would land.
   *
   * Kept here rather than in the store: a half-finished drag is not part of the
   * program, and putting it in the store would push it through undo/redo and
   * into every save file.
   */
  const [drag, setDrag] = useState(null)
  const [collapsed, setCollapsed] = useState(() => new Set())

  const toggleCollapse = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const drop = (parentId, slot, index) => {
    if (!drag) return
    setProgram(moveBlock(program, drag, parentId, slot, index))
    setDrag(null)
    sfx.snap()
  }

  const targetLabel = target.label ?? t('ui.program')

  const add = (type) => {
    const block = makeBlock(type)
    /*
     * The target container may be long gone — deleted, or replaced wholesale
     * when code was applied from the Arduino tab (which mints new ids). In
     * that case insertBlock() would return the list unchanged and the new
     * block silently evaporates, making every palette chip look dead. Fall
     * back to the top level and say so in the pill.
     */
    const targetAlive = target.id == null || findBlock(program, target.id)
    const where = targetAlive ? target : { id: null, slot: 'body', label: null }
    if (!targetAlive) setTarget(where)
    setProgram(insertBlock(program, block, where.id, where.slot))
    sfx.click()
    if (CONTAINER_TYPES.includes(type)) {
      setTarget({ id: block.id, slot: 'body', label: t(`blocks.${type}.label`) })
      say('blocksInside')
    }
  }

  return (
    <div>
      <div className="palette">
        {Object.entries(BLOCK_TYPES).map(([type, meta]) => (
          <button
            key={type}
            className={`chip ${meta.colour}${type === 'drive' ? ' hero' : ''}`}
            title={t(`blocks.${type}.hint`)}
            data-block={type}
            onClick={() => add(type)}
          >
            {meta.icon} {t(`blocks.${type}.label`)}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          className={target.id ? 'add-inside is-on' : 'add-inside'}
          onClick={() => setTarget({ id: null, slot: 'body', label: null })}
        >
          {t('ui.addingTo', { where: targetLabel })}
          {target.id ? t('ui.backToTop') : ''}
        </button>
      </div>

      {program.length === 0 ? (
        <div className="empty-note">
          {t('ui.emptyProgram', { block: `“${t('blocks.drive.label')}”` })}
        </div>
      ) : (
        <BlockList
          blocks={program}
          parentId={null}
          slot="body"
          program={program}
          setProgram={setProgram}
          pinMap={pinMap}
          target={target}
          setTarget={setTarget}
          drag={drag}
          setDrag={setDrag}
          drop={drop}
          collapsed={collapsed}
          toggleCollapse={toggleCollapse}
          t={t}
        />
      )}
    </div>
  )
}

/**
 * One list of blocks, with a drop zone above each row and one at the end.
 *
 * The zones are what make the drag land somewhere specific rather than merely
 * "in this container": a student dropping between two blocks means between
 * them. They only render while a drag is live, so the layout is unchanged the
 * rest of the time.
 */
function BlockList({ blocks, parentId, slot, ...rest }) {
  const { drag, drop } = rest
  const zone = (index) =>
    drag ? (
      <div
        className="drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          drop(parentId, slot, index)
        }}
      />
    ) : null

  return (
    <div className="blocks">
      {blocks.map((block, i) => (
        <div key={block.id}>
          {zone(i)}
          <BlockRow block={block} {...rest} />
        </div>
      ))}
      {zone(blocks.length)}
    </div>
  )
}

function BlockRow({
  block,
  program,
  setProgram,
  pinMap,
  target,
  setTarget,
  drag,
  setDrag,
  drop,
  collapsed,
  toggleCollapse,
  t,
}) {
  const meta = BLOCK_TYPES[block.type] ?? { colour: 'slate', icon: '❓' }
  const set = (patch) => setProgram(updateBlock(program, block.id, patch))
  const isContainer = CONTAINER_TYPES.includes(block.type)
  const isCollapsed = collapsed.has(block.id)
  const rest = { program, setProgram, pinMap, target, setTarget, drag, setDrag, drop, collapsed, toggleCollapse, t }

  return (
    <div className={drag === block.id ? 'block-wrap is-dragging' : 'block-wrap'}>
      <div
        className={`block ${meta.colour}`}
        title={t(`blocks.${block.type}.hint`)}
        data-block-row={block.type}
        data-block-id={block.id}
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          // Firefox refuses to start a drag without payload on the transfer.
          e.dataTransfer.setData('text/plain', block.id)
          e.dataTransfer.effectAllowed = 'move'
          setDrag(block.id)
        }}
        onDragEnd={() => setDrag(null)}
      >
        <span className="block-grip" title={t('ui.dragHandle')}>
          ⠿
        </span>
        <span className="block-icon">{meta.icon}</span>
        <span className="block-label">{t(`blocks.${block.type}.label`)}</span>

        {block.type === 'drive' && (
          <>
            <select value={block.dir} onChange={(e) => set({ dir: e.target.value })}>
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {t(`blocks.dir${d[0].toUpperCase()}${d.slice(1)}`)}
                </option>
              ))}
            </select>
            <span>{t('blocks.for')}</span>
            <input
              type="number"
              min={100}
              step={100}
              value={block.ms}
              onChange={(e) => set({ ms: Number(e.target.value) })}
            />
            <span>{t('blocks.ms')}</span>
            <span>{t('blocks.speed')}</span>
            <input
              type="number"
              min={0}
              max={255}
              step={10}
              value={block.speed}
              onChange={(e) => set({ speed: Number(e.target.value) })}
            />
          </>
        )}

        {block.type === 'digitalWrite' && (
          <>
            <PinSelect value={block.pin} pinMap={pinMap} onChange={(pin) => set({ pin })} t={t} />
            <select value={block.value} onChange={(e) => set({ value: e.target.value })}>
              <option value="HIGH">{t('blocks.on')}</option>
              <option value="LOW">{t('blocks.off')}</option>
            </select>
          </>
        )}

        {block.type === 'motor' && (
          <>
            <PinSelect value={block.pin} pinMap={pinMap} onChange={(pin) => set({ pin })} t={t} />
            <span>{t('blocks.speed')}</span>
            <input
              type="number"
              min={-255}
              max={255}
              step={10}
              value={block.speed}
              onChange={(e) => set({ speed: Number(e.target.value) })}
            />
          </>
        )}

        {block.type === 'servo' && (
          <>
            <PinSelect value={block.pin} pinMap={pinMap} onChange={(pin) => set({ pin })} t={t} />
            <span>{t('blocks.angle')}</span>
            <input
              type="number"
              min={0}
              max={180}
              step={5}
              value={block.angle}
              onChange={(e) => set({ angle: Number(e.target.value) })}
            />
            <span>°</span>
          </>
        )}

        {block.type === 'wait' && (
          <>
            <input
              type="number"
              min={0}
              step={100}
              value={block.ms}
              onChange={(e) => set({ ms: Number(e.target.value) })}
            />
            <span>{t('blocks.ms')}</span>
          </>
        )}

        {block.type === 'print' && (
          <input
            type="text"
            className="grow"
            value={block.text}
            onChange={(e) => set({ text: e.target.value })}
          />
        )}

        {block.type === 'repeat' && (
          <>
            <input
              type="number"
              min={1}
              max={500}
              value={block.times}
              onChange={(e) => set({ times: Number(e.target.value) })}
            />
            <span>{t('blocks.times')}</span>
          </>
        )}

        {block.type === 'ifDistance' && (
          <>
            <select value={block.op} onChange={(e) => set({ op: e.target.value })}>
              <option value="<">{t('blocks.closer')}</option>
              <option value=">">{t('blocks.further')}</option>
            </select>
            <input
              type="number"
              min={1}
              max={200}
              value={block.cm}
              onChange={(e) => set({ cm: Number(e.target.value) })}
            />
            <span>{t('blocks.cm')}</span>
          </>
        )}

        {block.type === 'setVar' && (
          <>
            <input
              type="text"
              className="var-name"
              value={block.name}
              onChange={(e) => set({ name: e.target.value })}
            />
            <span>{t('blocks.to')}</span>
            <OperandInput value={block.a} onChange={(a) => set({ a })} t={t} />
            <select value={block.op} onChange={(e) => set({ op: e.target.value })}>
              {MATH_OPS.map((op) => (
                <option key={op || 'none'} value={op}>
                  {op || t('blocks.plain')}
                </option>
              ))}
            </select>
            {block.op ? <OperandInput value={block.b} onChange={(b) => set({ b })} t={t} /> : null}
          </>
        )}

        {(block.type === 'ifCompare' || block.type === 'whileCompare') && (
          <>
            <OperandInput value={block.a} onChange={(a) => set({ a })} t={t} />
            <select value={block.op} onChange={(e) => set({ op: e.target.value })}>
              {COMPARE_OPS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <OperandInput value={block.b} onChange={(b) => set({ b })} t={t} />
          </>
        )}

        <span style={{ flex: 1 }} />
        {isContainer && (
          <button
            className="block-tool"
            title={t(isCollapsed ? 'ui.expand' : 'ui.collapse')}
            onClick={() => toggleCollapse(block.id)}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
        )}
        <button
          className="block-tool"
          title={t('ui.duplicate')}
          data-testid="block-duplicate"
          onClick={() => {
            setProgram(duplicateBlock(program, block.id))
            sfx.click()
          }}
        >
          ⧉
        </button>
        <button
          className="block-x"
          onClick={() => {
            // If the deleted block was (or contained) the "adding to" target,
            // point the palette back at the top level right away — not on the
            // next add — so the pill never names a container that is gone.
            if (target.id != null && (target.id === block.id || findBlock([block], target.id)))
              setTarget({ id: null, slot: 'body', label: null })
            setProgram(removeBlock(program, block.id))
          }}
        >
          ✕
        </button>
      </div>

      {isContainer && !isCollapsed && (
        <div className="block-children">
          <BlockList blocks={block.body ?? []} parentId={block.id} slot="body" {...rest} />
          <button
            className={
              target.id === block.id && target.slot === 'body' ? 'add-inside is-on' : 'add-inside'
            }
            onClick={() =>
              setTarget({ id: block.id, slot: 'body', label: t(`blocks.${block.type}.label`) })
            }
          >
            {t('ui.putInside', { label: t(`blocks.${block.type}.label`) })}
          </button>

          {(block.type === 'ifDistance' || block.type === 'ifCompare') && (
            <>
              <div className="else-label">{t('ui.otherwise')}</div>
              <BlockList
                blocks={block.elseBody ?? []}
                parentId={block.id}
                slot="elseBody"
                {...rest}
              />
              <button
                className={
                  target.id === block.id && target.slot === 'elseBody'
                    ? 'add-inside is-on'
                    : 'add-inside'
                }
                onClick={() =>
                  setTarget({ id: block.id, slot: 'elseBody', label: t('ui.otherwise') })
                }
              >
                {t('ui.putInElse')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One value: a number, a variable, or the live sensor reading.
 *
 * A dropdown for the kind and then whatever that kind needs, so the same three
 * controls cover every place a value can appear. A student never has to learn
 * "the left side of an if" as a separate idea from "the right side of a set".
 */
function OperandInput({ value, onChange, t }) {
  const src = value?.src ?? 'num'
  return (
    <span className="operand">
      <select
        value={src}
        onChange={(e) => {
          const next = e.target.value
          if (next === 'num') onChange({ src: 'num', value: 0 })
          else if (next === 'var') onChange({ src: 'var', name: 'count' })
          else if (next === 'sensor') onChange({ src: 'sensor', pin: 14 })
          else onChange({ src: 'distance' })
        }}
      >
        {OPERAND_SOURCES.map((s) => (
          <option key={s} value={s}>
            {t(`blocks.src${s[0].toUpperCase()}${s.slice(1)}`)}
          </option>
        ))}
      </select>

      {src === 'num' && (
        <input
          type="number"
          value={value?.value ?? 0}
          onChange={(e) => onChange({ src: 'num', value: Number(e.target.value) })}
        />
      )}
      {src === 'var' && (
        <input
          type="text"
          className="var-name"
          value={value?.name ?? ''}
          onChange={(e) => onChange({ src: 'var', name: e.target.value })}
        />
      )}
      {src === 'sensor' && (
        <select aria-label={t('lab.sensorPin')} value={value?.pin ?? 14}
          onChange={(e) => onChange({ src: 'sensor', pin: Number(e.target.value) })}>
          {Array.from({ length: 18 }, (_, i) => i + 2).map((pin) => (
            <option key={pin} value={pin}>{pin >= 14 ? `A${pin - 14}` : `D${pin}`}</option>
          ))}
        </select>
      )}
      {src === 'distance' && <span className="operand-fixed">{t('blocks.cm')}</span>}
    </span>
  )
}

/** A pin picker that says what is actually plugged in, not just a number. */
function PinSelect({ value, pinMap, onChange, t }) {
  // Whatever the block already says must stay selectable, even a pin outside
  // the usual range — otherwise the control lies about the block's own state.
  const pins = BLOCK_PINS.includes(value)
    ? BLOCK_PINS
    : [value, ...BLOCK_PINS].sort((a, b) => b - a)
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {pins.map((pin) => (
        <option key={pin} value={pin}>
          {t('ui.pinN', { pin })}
          {pinMap[pin] ? ` · ${t(`parts.${pinMap[pin].kind}.name`)}` : ` · ${t('ui.empty')}`}
        </option>
      ))}
    </select>
  )
}
