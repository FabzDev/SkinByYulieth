import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuditPage } from './pages/AuditPage'
import { CatalogPage } from './pages/CatalogPage'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { ClientsPage } from './pages/ClientsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataPage } from './pages/DataPage'
import { ExpenseFormPage } from './pages/ExpenseFormPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { MorePage } from './pages/MorePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OtherIncomeFormPage } from './pages/OtherIncomeFormPage'
import { OtherIncomePage } from './pages/OtherIncomePage'
import { PaymentNewPage } from './pages/PaymentNewPage'
import { SaleDetailPage } from './pages/SaleDetailPage'
import { SaleFormPage } from './pages/SaleFormPage'
import { SalesPage } from './pages/SalesPage'
import { WithdrawalFormPage } from './pages/WithdrawalFormPage'
import { WithdrawalsPage } from './pages/WithdrawalsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />

          <Route path="/ventas" element={<SalesPage />} />
          <Route path="/ventas/nueva" element={<SaleFormPage />} />
          <Route path="/ventas/:id" element={<SaleDetailPage />} />
          <Route path="/ventas/:id/editar" element={<SaleFormPage />} />
          <Route path="/pagos/nuevo" element={<PaymentNewPage />} />

          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/:id" element={<ClientDetailPage />} />

          <Route path="/catalogo" element={<CatalogPage />} />

          <Route path="/gastos" element={<ExpensesPage />} />
          <Route path="/gastos/nuevo" element={<ExpenseFormPage />} />
          <Route path="/gastos/:id" element={<ExpenseFormPage />} />

          <Route path="/retiros" element={<WithdrawalsPage />} />
          <Route path="/retiros/nuevo" element={<WithdrawalFormPage />} />
          <Route path="/retiros/:id" element={<WithdrawalFormPage />} />

          <Route path="/otros-ingresos" element={<OtherIncomePage />} />
          <Route path="/otros-ingresos/nuevo" element={<OtherIncomeFormPage />} />
          <Route path="/otros-ingresos/:id" element={<OtherIncomeFormPage />} />

          <Route path="/historial" element={<HistoryPage />} />
          <Route path="/auditoria" element={<AuditPage />} />
          <Route path="/datos" element={<DataPage />} />
          <Route path="/mas" element={<MorePage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
