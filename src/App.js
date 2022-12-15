import { Route, Routes, Navigate, BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { useEffect } from "react";
import DashboardScreen from "./pages/DashboardScreen";
import InvoiceDetailScreen from "./pages/InvoiceDetailScreen";
import Container from "./components/Container/Container";
import useInitApp from "./hook/useInitApp";
import InvoiceConfirmModal from "./components/Invoice/InvoiceConfirmModal";
import InvoiceDeleteConfirm from "./components/Invoice/InvoiceDeleteConfirm";

const App = () => {
  const { initialSetData } = useInitApp();

  useEffect(() => {
    initialSetData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BrowserRouter>
      <Container>
        <Routes>
          <Route path="/" element={<DashboardScreen />} />

          <Route path="invoices">
            <Route path=":id" element={<InvoiceDetailScreen />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
      <ToastContainer />
      <InvoiceConfirmModal />
      <InvoiceDeleteConfirm />
    </BrowserRouter>
  );
};

export default App;
