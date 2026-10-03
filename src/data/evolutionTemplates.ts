export interface EvoNode {
  id: string
  stage: number // 1始まり
  label: string
  next: string[] // 先頭が通常ルート。2つ目以降は進化の石が必要な分岐ルート
}

export interface EvoTemplate {
  id: string
  name: string
  description: string
  nodes: EvoNode[]
}

export const TEMPLATES: EvoTemplate[] = [
  {
    id: 'linear3',
    name: '一本道（3段）',
    description: '1 → 2 → 3',
    nodes: [
      { id: 'n1', stage: 1, label: '第1段階', next: ['n2'] },
      { id: 'n2', stage: 2, label: '第2段階', next: ['n3'] },
      { id: 'n3', stage: 3, label: '第3段階（最終）', next: [] },
    ],
  },
  {
    id: 'lateBranch',
    name: '後半分岐',
    description: '1 → 2 → 最終が2種類',
    nodes: [
      { id: 'n1', stage: 1, label: '第1段階', next: ['n2'] },
      { id: 'n2', stage: 2, label: '第2段階', next: ['n3a', 'n3b'] },
      { id: 'n3a', stage: 3, label: '最終・通常ルート', next: [] },
      { id: 'n3b', stage: 3, label: '最終・分岐ルート（石）', next: [] },
    ],
  },
  {
    id: 'earlyBranch',
    name: '早めに分岐',
    description: '1 → 2種類に分岐 → それぞれの最終',
    nodes: [
      { id: 'n1', stage: 1, label: '第1段階', next: ['n2a', 'n2b'] },
      { id: 'n2a', stage: 2, label: '第2段階・通常ルート', next: ['n3a'] },
      { id: 'n2b', stage: 2, label: '第2段階・分岐ルート（石）', next: ['n3b'] },
      { id: 'n3a', stage: 3, label: '最終・通常ルート', next: [] },
      { id: 'n3b', stage: 3, label: '最終・分岐ルート', next: [] },
    ],
  },
  {
    id: 'early2',
    name: '早熟（2段）',
    description: '1 → 2 で完成',
    nodes: [
      { id: 'n1', stage: 1, label: '第1段階', next: ['n2'] },
      { id: 'n2', stage: 2, label: '第2段階（最終）', next: [] },
    ],
  },
  {
    id: 'late5',
    name: '大器晩成（5段）',
    description: '1 → 2 → 3 → 4 → 5',
    nodes: [
      { id: 'n1', stage: 1, label: '第1段階', next: ['n2'] },
      { id: 'n2', stage: 2, label: '第2段階', next: ['n3'] },
      { id: 'n3', stage: 3, label: '第3段階', next: ['n4'] },
      { id: 'n4', stage: 4, label: '第4段階', next: ['n5'] },
      { id: 'n5', stage: 5, label: '第5段階（最終）', next: [] },
    ],
  },
]

export const FIRST_NODE_ID = 'n1'

export function getTemplate(id: string): EvoTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

export function getNode(template: EvoTemplate, nodeId: string): EvoNode {
  return template.nodes.find((n) => n.id === nodeId) ?? template.nodes[0]
}
