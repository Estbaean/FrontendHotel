# Fix: Edit Date Deletes Rental Account Balance

## Steps:
- [x] 1. Add auto-refresh useEffect in CuentaAlquilerModal.jsx for subTotal changes
- [x] 2. Add manual Refresh button in CuentaAlquilerModal header
- [ ] 3. Test: Open cuenta → edit fecha → verify auto/manual refresh shows new saldo (base + consumos - pagos)
- [ ] 4. attempt_completion

Current: ✅ FIXED EditFechaSalidaModal preview logic + CuentaAlquilerModal refresh. Test ready!
