import { useHotel } from '../../context/HotelContext';
import { useAuth } from '../../context/AuthContext';
import GenericCRUD from '../../components/GenericCRUD.jsx';
import { Building2 } from 'lucide-react';

export default function Empresa() {
  const { userRole } = useAuth();
  const { empresas, addEmpresa, updateEmpresa, deleteEmpresa } = useHotel();
  const readOnly = userRole !== 'admin';

  const columns = [
    { key: 'nombre', label: 'Razón Social' },
    { key: 'ruc', label: 'RUC' },
    { key: 'telefono', label: 'Teléfono', render: e => e.telefono || '—' },
  ];

  const formFields = [
    { key: 'nombre', label: 'Nombre / Razón social', required: true, placeholder: 'Empresa Demo S.A.C.' },
    { key: 'ruc', label: 'RUC', required: true, placeholder: '20XXXXXXXXX' },
    { key: 'telefono', label: 'Teléfono', placeholder: '+51 1 234 5678' },
  ];

  return (
      <GenericCRUD
        items={empresas}
        onAdd={addEmpresa}
        onUpdate={updateEmpresa}
        onDelete={deleteEmpresa}
        columns={columns}
        formFields={formFields}
        emptyMsg="No hay empresas registradas"
        emptyIcon={<Building2 size={42} />}
        modalTitle="Empresa"
        readOnly={readOnly}
        pageTitle="Empresas"
        pageSubtitle="Gestión de empresas"
        searchPlaceholder="Razón social, RUC, teléfono…"
      />
  );
}

