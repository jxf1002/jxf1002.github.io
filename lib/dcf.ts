// DCF 纯计算，不碰 DOM，方便单测
export type DcfInputs = {
  netProfit: string
  growthYears: string
  growthRate: string
  terminalRate: string
  discountRate: string
}

export type DcfParsedInputs = {
  netProfit: number
  growthYears: number
  growthRate: number
  terminalRate: number
  discountRate: number
}

export type DcfRow = {
  year: number | string
  cf: number
  df: number
  pv: number
  cumPV: number
  isTerminal: boolean
}

export type DcfResult = {
  years: number
  growthRate: number
  terminalRate: number
  discountRate: number
  totalPV: number
  cumulativePV: number
  terminalPV: number
  terminalValid: boolean
  tableData: DcfRow[]
  chartLabels: string[]
  chartCF: number[]
  chartPV: number[]
}

export function parseInputs(raw: DcfInputs): DcfParsedInputs | null {
  const netProfit = parseFloat(raw.netProfit)
  const growthYears = parseInt(raw.growthYears, 10)
  const growthRate = parseFloat(raw.growthRate) / 100
  const terminalRate = parseFloat(raw.terminalRate) / 100
  const discountRate = parseFloat(raw.discountRate) / 100

  if (isNaN(netProfit) || netProfit <= 0) return null
  if (isNaN(growthYears) || growthYears < 0) return null
  if (isNaN(growthRate) || growthRate < 0) return null
  if (isNaN(terminalRate) || terminalRate < 0) return null
  if (isNaN(discountRate) || discountRate <= 0) return null

  return { netProfit, growthYears, growthRate, terminalRate, discountRate }
}

export function computeDcf(raw: DcfInputs): DcfResult | null {
  const inputs = parseInputs(raw)
  if (!inputs) return null
  const { netProfit, growthRate, terminalRate, discountRate } = inputs
  const years = inputs.growthYears

  const cashFlows: number[] = []
  const discountFactors: number[] = []
  const presentValues: number[] = []
  let cumulativePV = 0

  for (let i = 1; i <= years; i++) {
    const cf = netProfit * Math.pow(1 + growthRate, i)
    const df = 1 / Math.pow(1 + discountRate, i)
    const pv = cf * df
    cashFlows.push(cf)
    discountFactors.push(df)
    presentValues.push(pv)
    cumulativePV += pv
  }

  const lastCF = years > 0 ? cashFlows[cashFlows.length - 1] : netProfit
  const terminalDiscountFactor =
    years > 0 ? discountFactors[discountFactors.length - 1] : 1
  let terminalValue = 0
  let terminalPV = 0
  let terminalValid = true

  if (discountRate > terminalRate) {
    terminalValue =
      (lastCF * (1 + terminalRate)) / (discountRate - terminalRate)
    terminalPV = terminalValue * terminalDiscountFactor
  } else {
    terminalValid = false
    terminalValue = Infinity
    terminalPV = Infinity
  }

  const totalPV = cumulativePV + (terminalValid ? terminalPV : 0)

  const tableData: DcfRow[] = []
  for (let i = 0; i < years; i++) {
    tableData.push({
      year: i + 1,
      cf: cashFlows[i],
      df: discountFactors[i],
      pv: presentValues[i],
      cumPV: presentValues.slice(0, i + 1).reduce((a, b) => a + b, 0),
      isTerminal: false,
    })
  }

  tableData.push({
    year: "♾️ 永续期",
    cf: terminalValid ? terminalValue : Infinity,
    df: terminalDiscountFactor,
    pv: terminalValid ? terminalPV : Infinity,
    cumPV: terminalValid ? totalPV : Infinity,
    isTerminal: true,
  })

  const chartLabels: string[] = []
  const chartCF: number[] = []
  const chartPV: number[] = []
  for (let i = 0; i < years; i++) {
    chartLabels.push("第" + (i + 1) + "年")
    chartCF.push(cashFlows[i])
    chartPV.push(presentValues[i])
  }
  chartLabels.push("♾️ 永续期")
  chartCF.push(terminalValid ? terminalValue : 0)
  chartPV.push(terminalValid ? terminalPV : 0)

  return {
    years,
    growthRate,
    terminalRate,
    discountRate,
    totalPV,
    cumulativePV,
    terminalPV,
    terminalValid,
    tableData,
    chartLabels,
    chartCF,
    chartPV,
  }
}
