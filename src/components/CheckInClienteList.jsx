import { useState, useMemo, useEffect } from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import { useHotel } from '../context/HotelContext.jsx';
import { useAuth } from '../context/AuthContext';
import { SearchInput, ConfirmDialog, inputStyle, useToast } from './UI/index.jsx';
import ClienteFormModal from './ClienteFormModal.jsx';
import { Plus, Check } from 'lucide-react';
import s from './CheckInModal.module.css';

export default function CheckInClienteList({
  clientes = [],
  onClientesChange,
  onAddModeChange,
  representativeId,
  onRepresentativeChange,
}) {
  const { userRole } = useAuth();
  const { clientes: allClientes, addCliente, updateCliente, deleteCliente, tiposDocumento, empresas } = useHotel();
  const isAdmin = userRole === 'admin';
  const addToast = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipoCliente, setFilterTipoCliente] = useState('TODOS');
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => clientes.map((c) => c?.id).filter(Boolean));

  useEffect(() => {
    setSelectedIds(clientes.map((c) => c?.id).filter(Boolean));
  }, [clientes]);

  useEffect(() => {
    if (!selectedIds.length) {
      onRepresentativeChange?.(null);
      return;
    }
    if (!representativeId || !selectedIds.includes(representativeId)) {
      onRepresentativeChange?.(selectedIds[0]);
    }
  }, [selectedIds, representativeId, onRepresentativeChange]);

  const filteredClientes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return allClientes.filter((cliente) => {
      const matchSearch = !term
        || cliente.nombre?.toLowerCase().includes(term)
        || cliente.numDocumento?.toString().toLowerCase().includes(term);

      const esEmpresa = Boolean(cliente.empresaId || (cliente.empresaNombre && cliente.empresaNombre !== '—'));
      const matchTipo = filterTipoCliente === 'TODOS'
        || (filterTipoCliente === 'EMPRESA' && esEmpresa)
        || (filterTipoCliente === 'EXTERNO' && !esEmpresa);

      return matchSearch && matchTipo;
    });
  }, [allClientes, searchTerm, filterTipoCliente]);

  const updateSelectedClientes = (nextIds) => {
    const nextSelecionados = allClientes.filter((c) => nextIds.includes(c.id));
    setSelectedIds(nextIds);
    onClientesChange?.(nextSelecionados);
  };

  const toggleSelectCliente = (cliente) => {
    if (!cliente?.id) return;
    const isSelected = selectedIds.includes(cliente.id);
    const nextIds = isSelected ? selectedIds.filter((id) => id !== cliente.id) : [...selectedIds, cliente.id];
    updateSelectedClientes(nextIds);

    if (!isSelected && !representativeId) {
      onRepresentativeChange?.(cliente.id);
      return;
    }
    if (isSelected && representativeId === cliente.id) {
      onRepresentativeChange?.(nextIds[0] || null);
    }
  };

  const startEditCliente = (cliente) => {
    setEditingCliente(cliente);
  };

  const handleEditSaved = (updatedCliente) => {
    const refreshedSeleccionados = selectedIds
      .map((id) => {
        if (id === editingCliente?.id) return updatedCliente;
        return allClientes.find((c) => c.id === id);
      })
      .filter(Boolean);
    onClientesChange?.(refreshedSeleccionados);
    setEditingCliente(null);
  };

  const handleNewSaved = (savedCliente) => {
    if (!savedCliente?.id) return;
    const nextIds = [...selectedIds, savedCliente.id];
    updateSelectedClientes(nextIds);
    setShowNewModal(false);
    onAddModeChange?.(false);
  };

  const removeCliente = async (clienteId) => {
    setDeleteConfirmId(null);
    try {
      await deleteCliente(clienteId);
      const nextIds = selectedIds.filter((id) => id !== clienteId);
      setSelectedIds(nextIds);
      onClientesChange?.(allClientes.filter((c) => nextIds.includes(c.id)));
      if (editingCliente?.id === clienteId) setEditingCliente(null);
      addToast('Cliente eliminado', 'info');
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      addToast(backendMessage || 'No se puede eliminar: el cliente tiene alquileres asociados', 'error');
    }
  };

  return (
    <div className={s.checkinClientsSection}>
      <div className={s.clientsControls}>
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar cliente..." />
        <select
          value={filterTipoCliente}
          onChange={(e) => setFilterTipoCliente(e.target.value)}
          style={{ ...inputStyle, width: 126 }}
        >
          <option value="TODOS">Todos</option>
          <option value="EMPRESA">Empresa</option>
          <option value="EXTERNO">Externo</option>
        </select>
        <button
          className={`${s.addClientTop} ${showNewModal ? s.active : ''}`}
          title="Registrar nuevo huésped"
          type="button"
          onClick={() => setShowNewModal(true)}
        >
          <Plus size={16} />
        </button>
      </div>

      <div className={s.clientsAvailableList}>
        {filteredClientes.length === 0 ? (
          <div className={s.emptySearch}>No se encontraron clientes</div>
        ) : (
          filteredClientes.map((cliente) => {
            const isSelected = selectedIds.includes(cliente.id);
            const docLabel = cliente.tipoDocumento?.nombre || cliente.tipoDocumento || 'DNI';
            return (
              <div key={cliente.id} className={`${s.clientRow} ${isSelected ? s.selected : ''}`}>
                <Checkbox.Root
                  className={s.rudimentrCheckbox}
                  checked={isSelected}
                  onCheckedChange={() => toggleSelectCliente(cliente)}
                  id={`cliente-${cliente.id}`}
                >
                  <Checkbox.Indicator>
                    <Check size={14} />
                  </Checkbox.Indicator>
                </Checkbox.Root>

                <div className={s.clientRowText} onClick={() => toggleSelectCliente(cliente)}>
                  <strong>{cliente.nombre}</strong>
                  <span className={s.clientRowDoc}>{docLabel}: {cliente.numDocumento || '—'}</span>
                  {cliente.empresaNombre && cliente.empresaNombre !== '—' && (
                    <span className={s.clientRowEmpresa}>{cliente.empresaNombre}</span>
                  )}
                </div>
                <div className={s.clientRowActions}>
                  {isSelected && (
                    <button
                      type="button"
                      onClick={() => onRepresentativeChange?.(cliente.id)}
                      className={representativeId === cliente.id ? s.repActive : ''}
                    >
                      {representativeId === cliente.id ? 'Representante' : 'Marcar rep.'}
                    </button>
                  )}
                  <button type="button" onClick={() => startEditCliente(cliente)}>Editar</button>
                  {isAdmin && (
                    <button type="button" onClick={() => setDeleteConfirmId(cliente.id)}>Eliminar</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal compartido — editar */}
      <ClienteFormModal
        open={!!editingCliente}
        onOpenChange={(open) => !open && setEditingCliente(null)}
        cliente={editingCliente}
        onSaved={handleEditSaved}
      />

      {/* Modal compartido — crear (misma UX que editar) */}
      <ClienteFormModal
        open={showNewModal}
        onOpenChange={(open) => {
          setShowNewModal(open);
          if (!open) onAddModeChange?.(false);
        }}
        cliente={null}
        onSaved={handleNewSaved}
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={setDeleteConfirmId}
        onConfirm={() => removeCliente(deleteConfirmId)}
        message="¿Eliminar este cliente? Esta acción no se puede deshacer."
      />
    </div>
  );
}

