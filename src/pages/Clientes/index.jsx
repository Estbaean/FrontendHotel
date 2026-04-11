import { useState, useMemo } from 'react';
import { useHotel } from '../../context/HotelContext';
import { useAuth } from '../../context/AuthContext';
import {
  Btn,
  Card,
  ConfirmDialog,
  DeleteBtn,
  EditBtn,
  EmptyState,
  PageHeader,
  Pagination,
  Table,
  tdStyle,
  useToast,
} from '../../components/UI/index.jsx';
import PageToolbar from '../../components/PageToolbar';
import ClienteFormModal from '../../components/ClienteFormModal.jsx';
import { Plus, Users } from 'lucide-react';

const PER_PAGE = 10;

export default function Clientes() {
  const { userRole } = useAuth();
  const { clientes, addCliente, updateCliente, deleteCliente, tiposDocumento } = useHotel();
  const addToast = useToast();
  const isAdmin = userRole === 'admin';
  const canEdit = userRole === 'admin' || userRole === 'recepcion';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterTipoDoc, setFilterTipoDoc] = useState('0');
  const [filterEmpresa, setFilterEmpresa] = useState('0');
  const [modalOpen, setModalOpen] = useState(false);
  const [editCliente, setEditCliente] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const tipoDocOptions = useMemo(() => {
    const nombres = [...new Set(clientes.map(c => c.tipoDocumento?.nombre).filter(Boolean))].sort();
    return [{ value: '0', label: 'Todos' }, ...nombres.map(n => ({ value: n, label: n }))];
  }, [clientes]);

  const empresaOptions = [
    { value: '0', label: 'Todos' },
    { value: 'EMPRESA', label: 'Con empresa' },
    { value: 'EXTERNO', label: 'Sin empresa' },
  ];

  const filtered = useMemo(() => {
    let result = clientes;
    if (filterTipoDoc && filterTipoDoc !== '0') {
      result = result.filter(c => c.tipoDocumento?.nombre === filterTipoDoc);
    }
    if (filterEmpresa === 'EMPRESA') {
      result = result.filter(c => c.empresaNombre && c.empresaNombre !== '—');
    } else if (filterEmpresa === 'EXTERNO') {
      result = result.filter(c => !c.empresaNombre || c.empresaNombre === '—');
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.nombre?.toLowerCase().includes(q)
        || c.numDocumento?.toLowerCase().includes(q)
        || c.telefono?.toLowerCase().includes(q)
        || c.empresaNombre?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [clientes, filterTipoDoc, filterEmpresa, search]);

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const openNew = () => {
    setEditCliente(null);
    setModalOpen(true);
  };

  const openEdit = (cliente) => {
    setEditCliente(cliente);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      await deleteCliente(confirmId);
      addToast('Cliente eliminado', 'info');
    } catch (error) {
      const msg = error?.response?.data?.message;
      addToast(msg || 'Error al eliminar cliente', 'error');
    }
    setConfirmId(null);
  };

  return (
    <div className="page-anim">
      <PageHeader title="Clientes" subtitle={`Gestión de huéspedes y empresas · ${filtered.length}`}>
        {canEdit && <Btn icon={<Plus size={14} />} onClick={openNew}>Nuevo</Btn>}
      </PageHeader>

      <PageToolbar>
        <PageToolbar.Row inline>
          <PageToolbar.Search value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Nombre, documento, teléfono…" />
          <PageToolbar.Filter label="Tipo Doc." value={filterTipoDoc} onChange={(v) => { setFilterTipoDoc(v); setPage(1); }} options={tipoDocOptions} />
          <PageToolbar.Filter label="Empresa" value={filterEmpresa} onChange={(v) => { setFilterEmpresa(v); setPage(1); }} options={empresaOptions} />
        </PageToolbar.Row>
      </PageToolbar>

      <Card>
        {paged.length === 0 ? (
          <EmptyState message={search || filterTipoDoc !== '0' || filterEmpresa !== '0' ? 'No hay clientes que coincidan con los filtros' : 'No hay clientes registrados'} icon={<Users size={42} />} />
        ) : (
          <Table headers={['Nombre Completo', 'Documento', 'Tipo Doc.', 'Teléfono', 'Empresa', '']}>
            {paged.map((item) => (
              <tr
                key={item.id}
              >
                <td style={tdStyle}>{item.nombre ?? '—'}</td>
                <td style={tdStyle}>{item.numDocumento ?? '—'}</td>
                <td style={tdStyle}>{item.tipoDocumento?.nombre ?? '—'}</td>
                <td style={tdStyle}>{item.telefono ?? '—'}</td>
                <td style={tdStyle}>{item.empresaNombre ?? '—'}</td>
                <td style={{ ...tdStyle, width: canEdit ? 80 : 0, padding: canEdit ? 'inherit' : 0 }}>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <EditBtn onClick={() => openEdit(item)} />
                      {isAdmin && <DeleteBtn onClick={() => setConfirmId(item.id)} />}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <div style={{ padding: '0 16px 4px' }}>
          <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
        </div>
      </Card>

      {canEdit && (
        <ClienteFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          cliente={editCliente}
          onSaved={() => {}}
        />
      )}

      {isAdmin ? (
        <ConfirmDialog
          open={!!confirmId}
          onOpenChange={(open) => !open && setConfirmId(null)}
          onConfirm={handleDelete}
        />
      ) : null}
    </div>
  );
}

