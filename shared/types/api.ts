/** Contrato de la API expuesta por el preload al renderer (window.api). */
import type {
  Person,
  PersonInput,
  ServiceCatalogItem,
  Equipment,
  Transaction,
  BarProduct,
  BarSale,
  Expense,
  ClientBill,
  ProfessorSettlement,
  DailyCashflowRow,
  MonthSummary,
  AgeBucket,
  PaymentPlan,
  ImportReport
} from './domain'

export interface AppStatus {
  hasPin: boolean
  needsImport: boolean
  schemaVersion: number
  userDataPath: string
}

export interface AppApi {
  auth: {
    status(): Promise<AppStatus>
    hasPin(): Promise<boolean>
    setPin(pin: string): Promise<{ ok: boolean }>
    verify(pin: string): Promise<{ ok: boolean; lockedForMs?: number; remainingAttempts?: number }>
    change(current: string, next: string): Promise<{ ok: boolean }>
  }
  import: {
    pickFile(): Promise<string | null>
    run(path: string): Promise<ImportReport>
  }
  persons: {
    list(filter?: {
      role?: 'client' | 'professor' | 'supplier'
      search?: string
      onlyActive?: boolean
      limit?: number
      offset?: number
    }): Promise<Person[]>
    count(filter?: { role?: 'client' | 'professor' | 'supplier'; search?: string; onlyActive?: boolean }): Promise<number>
    get(id: number): Promise<Person | null>
    create(input: PersonInput): Promise<Person>
    update(id: number, input: PersonInput): Promise<Person>
    remove(id: number): Promise<void>
    setPhoto(id: number, dataBase64: string): Promise<{ photoPath: string; photoThumbPath: string }>
    photoDataUrl(id: number): Promise<string | null>
  }
  catalog: {
    listServices(onlyActive?: boolean): Promise<ServiceCatalogItem[]>
    createService(s: Omit<ServiceCatalogItem, 'id'>): Promise<ServiceCatalogItem>
    updateService(id: number, s: Omit<ServiceCatalogItem, 'id'>): Promise<ServiceCatalogItem>
    listEquipment(onlyActive?: boolean): Promise<Equipment[]>
  }
  transactions: {
    list(filter?: { clientId?: number; professorId?: number; from?: string; to?: string; limit?: number; offset?: number }): Promise<Transaction[]>
    create(input: any): Promise<Transaction>
    remove(id: number): Promise<void>
  }
  bar: {
    listProducts(): Promise<BarProduct[]>
    createSale(input: any): Promise<BarSale>
    listSales(from?: string, to?: string): Promise<BarSale[]>
  }
  expenses: {
    list(from?: string, to?: string): Promise<Expense[]>
    create(input: any): Promise<Expense>
    remove(id: number): Promise<void>
  }
  bills: {
    preview(clientId: number, opts?: any): Promise<any>
    save(clientId: number, opts?: any): Promise<ClientBill>
    pdf(billId: number): Promise<string>
    email(billId: number): Promise<{ ok: boolean; error?: string }>
  }
  settlements: {
    preview(professorId: number, year: number, month: number): Promise<any>
    save(professorId: number, year: number, month: number): Promise<ProfessorSettlement>
    pdf(professorId: number, year: number, month: number): Promise<string>
  }
  finance: {
    dailyCashflow(from?: string, to?: string): Promise<{ rows: DailyCashflowRow[]; totals: { in: number; out: number; net: number } }>
    monthSummary(year: number, month: number): Promise<MonthSummary>
    ageStats(): Promise<AgeBucket[]>
    yearBalance(): Promise<{ year: number; in: number; out: number }[]>
    dashboard(): Promise<Record<string, number>>
  }
  plans: {
    list(): Promise<(PaymentPlan & { outstanding: number })[]>
    get(id: number): Promise<(PaymentPlan & { outstanding: number }) | null>
    create(title: string, personId: number | null, principal: number, startDate: string | null): Promise<PaymentPlan & { outstanding: number }>
    addInstallment(planId: number, paidDate: string, amount: number, comment: string | null): Promise<PaymentPlan & { outstanding: number }>
  }
  settings: {
    getCompany(): Promise<any>
    setCompany(cfg: any): Promise<void>
    getSmtp(): Promise<{ host: string; port: number; user: string; from: string; hasPassword: boolean }>
    setSmtp(cfg: { host: string; port: number; user: string; from: string; password?: string }): Promise<void>
    testSmtp(): Promise<{ ok: boolean; error?: string }>
    setBarDiscount(pct: number): Promise<void>
    getBarDiscount(): Promise<number>
  }
  backup: {
    create(): Promise<string>
    list(): Promise<{ file: string; size: number; mtime: string }[]>
  }
  exports: {
    balance(from?: string, to?: string): Promise<string>
    monthSummary(year: number, month: number): Promise<string>
    openFolder(): Promise<void>
  }
}
