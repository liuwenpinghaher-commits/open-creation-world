import { useMemo, useState } from 'react'
import { Boxes, Brain, FolderOpen, GitBranch, Sparkles } from 'lucide-react'
import './App.css'
import { TldrawWorld } from './components/TldrawWorld'
import { SemanticCard } from './components/SemanticCard'
import { InteractionPanel } from './components/InteractionPanel'
import { ReplayPanel } from './components/ReplayPanel'
import { ParentSummaryPanel } from './components/ParentSummaryPanel'
import { firstValidationScenario } from './domain/challenge'
import { appendWorldEvent, detectLearningOpportunity, initialEventLog } from './domain/events'
import { resolveInteraction } from './domain/interactions'
import { evaluateRulePacks } from './domain/rules'
import { buildParentSummary } from './domain/summary'
import { confirmSemanticDraft, createSemanticDraft, updateWorldObjectCapabilities } from './domain/semantic'
import { loadSessionSnapshot, saveSessionSnapshot } from './persistence/db'
import { creationWorkflowMachine, type WorkflowStep, workflowStepLabels } from './domain/workflow'
import type { CapabilityId, ConstraintId, EventLog, InteractionDecision, ParentSummary, SimulationResult, WorldObject } from './domain/types'

type AppProps = {
  disableTldraw?: boolean
}

const sessionId = 'session:local-open-creation'

export default function App({ disableTldraw = false }: AppProps) {
  const [name, setName] = useState('弹跳蘑菇城堡')
  const [description, setDescription] = useState('它像城堡，也会弹跳，还可以保护里面的小人')
  const [draft, setDraft] = useState<WorldObject | undefined>()
  const [worldObject, setWorldObject] = useState<WorldObject | undefined>()
  const [selectedCapabilities, setSelectedCapabilities] = useState<CapabilityId[]>([])
  const [selectedConstraints, setSelectedConstraints] = useState<ConstraintId[]>([])
  const [contactArea, setContactArea] = useState(2)
  const [energy, setEnergy] = useState(3)
  const [action, setAction] = useState('cross')
  const [terrain, setTerrain] = useState('mud')
  const [load, setLoad] = useState(3)
  const [distance, setDistance] = useState(2)
  const [decision, setDecision] = useState<InteractionDecision | undefined>()
  const [result, setResult] = useState<SimulationResult | undefined>()
  const [summary, setSummary] = useState<ParentSummary | undefined>()
  const [eventLog, setEventLog] = useState<EventLog>(() => initialEventLog(sessionId))
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('create')
  const [saveState, setSaveState] = useState('未保存')

  const activeObject = worldObject ?? draft
  const machineId = creationWorkflowMachine.id

  const evidence = useMemo(() => (result ? detectLearningOpportunity(result, true) : undefined), [result])

  function handleCreateDraft() {
    const nextDraft = createSemanticDraft({
      name,
      childDescription: description,
      shapeIds: [`shape:${Date.now()}`],
    })
    setDraft(nextDraft)
    setWorldObject(undefined)
    setSelectedCapabilities(nextDraft.capabilities.map((capability) => capability.id))
    setSelectedConstraints(nextDraft.constraints.map((constraint) => constraint.id))
    setContactArea(Number(nextDraft.properties.contactArea ?? 2))
    setEnergy(Number(nextDraft.properties.energy ?? 3))
    setResult(undefined)
    setSummary(undefined)
    setDecision(undefined)
    setWorkflowStep('semantic_confirm')
    setEventLog((log) => appendWorldEvent(log, { type: 'object.created', object: nextDraft }))
  }

  function handleConfirm() {
    if (!draft) return
    const confirmed = confirmSemanticDraft(
      {
        ...draft,
        properties: { ...draft.properties, contactArea, energy },
      },
      {
        childApproved: true,
        selectedCapabilityIds: selectedCapabilities,
        selectedConstraintIds: selectedConstraints,
      }
    )
    setWorldObject(confirmed)
    setDraft(confirmed)
    setWorkflowStep('interact')
    setEventLog((log) => appendWorldEvent(log, { type: 'object.semantic_confirmed', object: confirmed }))
  }

  async function runSimulation(objectOverride?: WorldObject) {
    const object = objectOverride ?? worldObject
    if (!object) return

    setWorkflowStep(result ? 'retest' : 'simulate')
    const nextDecision = resolveInteraction({
      actor: object,
      childIntent: `${object.name} ${action}`,
      requestedAction: action,
      context: { terrain, load, distance },
    })
    setDecision(nextDecision)

    if (!nextDecision.proposedRequest) {
      setWorkflowStep(nextDecision.decision === 'light_interaction' ? 'reflect' : 'interact')
      return
    }

    const nextResult = await evaluateRulePacks({ actor: object, request: nextDecision.proposedRequest })
    const opportunity = detectLearningOpportunity(nextResult, true)
    const nextLog = appendWorldEvent(
      appendWorldEvent(eventLog, { type: 'interaction.requested', request: nextDecision.proposedRequest }),
      { type: 'interaction.simulated', requestId: nextDecision.proposedRequest.id, result: nextResult }
    )
    const nextSummary = buildParentSummary({
      sessionId,
      objects: [object],
      events: nextLog.events,
      learningEvidence: [opportunity],
    })

    setEventLog(nextLog)
    setResult(nextResult)
    setSummary(nextSummary)
    setWorkflowStep(nextResult.outcome === 'failed' ? 'explain' : 'reflect')
  }

  function handleModify() {
    if (!worldObject) return
    const modified = updateWorldObjectCapabilities(worldObject, {
      addCapabilities: ['move'],
      addConstraints: ['low_contact_area_sinks'],
      propertyPatch: { contactArea: 5 },
    })
    setWorldObject(modified)
    setDraft(modified)
    setContactArea(5)
    setWorkflowStep('modify')
    setEventLog((log) => appendWorldEvent(log, { type: 'object.modified', objectId: modified.id, patch: { properties: { contactArea: 5 } } }))
  }

  async function handleRetest() {
    if (!worldObject) return
    await runSimulation({ ...worldObject, properties: { ...worldObject.properties, contactArea: 5 } })
  }

  async function handleSave() {
    if (!worldObject || !result || !summary) return
    await saveSessionSnapshot({
      sessionId,
      objects: [worldObject],
      events: eventLog.events,
      replays: [{ id: 'replay:latest', keyframes: result.keyframes }],
      summaries: [summary],
      tldrawSnapshot: { savedFrom: 'open-creation-world', objectName: worldObject.name },
    })
    setSaveState('已保存')
    setWorkflowStep('saved')
  }

  async function handleLoad() {
    const snapshot = await loadSessionSnapshot(sessionId)
    const loadedObject = snapshot?.objects[0]
    if (!snapshot || !loadedObject) return

    const latestResult = [...snapshot.events]
      .reverse()
      .find((event) => event.type === 'interaction.simulated')?.result

    setName(loadedObject.name)
    setDescription(loadedObject.description ?? '')
    setDraft(loadedObject)
    setWorldObject(loadedObject)
    setSelectedCapabilities(loadedObject.capabilities.map((capability) => capability.id))
    setSelectedConstraints(loadedObject.constraints.map((constraint) => constraint.id))
    setContactArea(Number(loadedObject.properties.contactArea ?? 2))
    setEnergy(Number(loadedObject.properties.energy ?? 3))
    setEventLog({ sessionId: snapshot.sessionId, events: snapshot.events })
    setResult(latestResult)
    setSummary(snapshot.summaries.at(-1))
    setSaveState('已加载')
    setWorkflowStep('saved')
  }

  function toggleCapability(id: CapabilityId) {
    setSelectedCapabilities((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function toggleConstraint(id: ConstraintId) {
    setSelectedConstraints((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>创造世界</h1>
          <p>{firstValidationScenario.title}</p>
        </div>
        <div className="topbar-metrics">
          <span>
            <GitBranch size={15} />
            {machineId}
          </span>
          <span>
            <Brain size={15} />
            {workflowStepLabels[workflowStep]}
          </span>
          <span>
            <Boxes size={15} />
            {saveState}
          </span>
          <button type="button" onClick={() => void handleLoad()}>
            <FolderOpen size={15} />
            加载本地
          </button>
        </div>
      </header>

      <section className="workspace">
        <section className="canvas-panel" role="region" aria-label="开放创造画布">
          <div className="creation-toolbar">
            <label>
              造物名称
              <input aria-label="造物名称" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              孩子描述
              <input aria-label="孩子描述" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <button className="primary-action" type="button" onClick={handleCreateDraft}>
              <Sparkles size={16} />
              生成语义卡
            </button>
          </div>
          <TldrawWorld object={activeObject} disabled={disableTldraw} />
        </section>

        <aside className="side-column">
          <SemanticCard
            draft={draft}
            selectedCapabilities={selectedCapabilities}
            selectedConstraints={selectedConstraints}
            contactArea={contactArea}
            energy={energy}
            onCapabilityToggle={toggleCapability}
            onConstraintToggle={toggleConstraint}
            onContactAreaChange={setContactArea}
            onEnergyChange={setEnergy}
            onConfirm={handleConfirm}
          />
        </aside>
      </section>

      <section className="bottom-grid">
        <InteractionPanel
          action={action}
          terrain={terrain}
          load={load}
          distance={distance}
          decision={decision}
          result={result}
          canSimulate={!!worldObject}
          onActionChange={setAction}
          onTerrainChange={setTerrain}
          onLoadChange={setLoad}
          onDistanceChange={setDistance}
          onSimulate={() => void runSimulation()}
          onModify={handleModify}
          onRetest={() => void handleRetest()}
          onSave={() => void handleSave()}
        />
        <ReplayPanel keyframes={result?.keyframes ?? []} />
        <ParentSummaryPanel summary={summary} />
      </section>
    </main>
  )
}
