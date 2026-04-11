import { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { PageHeader, Btn } from '../../components/UI/index.jsx';
import GenericCRUD from '../../components/GenericCRUD.jsx';
import { BedDouble, Clock, Plus } from 'lucide-react';
import s from '../../styles/shared.module.css';

export default function Configuracion() {
  const {
    tiposHabitacion, addTipoHabitacion, updateTipoHabitacion, deleteTipoHabitacion,
    tiposAlquiler, addTipoAlquiler, updateTipoAlquiler, deleteTipoAlquiler,
    userRole,
  } = useHotel();

  const readOnly = userRole !== 'admin';
  const [tab, setTab] = useState('habitacion');
  const [triggerNew, setTriggerNew] = useState(0);

  return (
    <div className="page-anim">
      <PageHeader title="Configuración" subtitle="Tipos de habitación y alquiler">
        {!readOnly && (
          <Btn icon={<Plus size={14} />} onClick={() => setTriggerNew(n => n + 1)}>
            {tab === 'habitacion' ? 'Nuevo Tipo Habitación' : 'Nuevo Tipo Alquiler'}
          </Btn>
        )}
      </PageHeader>

      {/* Tab selector */}
      <div className={s.tabBar}>
        <button onClick={() => { setTab('habitacion'); setTriggerNew(0); }} className={tab === 'habitacion' ? s.tabBtnActive : s.tabBtn}>
          Tipos de Habitación
          <span className={s.tabBadge} style={{ background: 'var(--accent)' }}>
            {tiposHabitacion.length}
          </span>
        </button>
        <button onClick={() => { setTab('alquiler'); setTriggerNew(0); }} className={tab === 'alquiler' ? s.tabBtnActive : s.tabBtn}>
          Tipos de Alquiler
          <span className={s.tabBadge} style={{ background: 'var(--text-muted)' }}>
            {tiposAlquiler.length}
          </span>
        </button>
      </div>

      {tab === 'habitacion' && (
        <GenericCRUD
          items={tiposHabitacion}
          onAdd={addTipoHabitacion}
          onUpdate={updateTipoHabitacion}
          onDelete={deleteTipoHabitacion}
          columns={[{ key: 'nombre', label: 'Nombre' }]}
          formFields={[{ key: 'nombre', label: 'Nombre del tipo', required: true, placeholder: 'SIMPLE' }]}
          emptyMsg="No hay tipos de habitación configurados"
          emptyIcon={<BedDouble size={42} />}
          modalTitle="Tipo de Habitación"
          readOnly={readOnly}
          hideToolbarAdd
          triggerNew={triggerNew}
        />
      )}

      {tab === 'alquiler' && (
        <GenericCRUD
          items={tiposAlquiler}
          onAdd={addTipoAlquiler}
          onUpdate={updateTipoAlquiler}
          onDelete={deleteTipoAlquiler}
          columns={[
            { key: 'nombre', label: 'Nombre' },
            { key: 'unidad', label: 'Unidad', render: (item) => item.unidad === 'HORA' ? 'Horas' : 'Días' },
            { key: 'multiplicador', label: 'Multiplicador' },
          ]}
          formFields={[
            { key: 'nombre', label: 'Nombre del tipo', required: true, placeholder: 'POR SEMANA' },
            { key: 'unidad', label: 'Unidad de tiempo', required: true, type: 'select', options: [
              { value: 'HORA', label: 'Horas' },
              { value: 'DIA', label: 'Días' },
            ]},
            { key: 'multiplicador', label: 'Multiplicador', required: true, type: 'number', min: 1, placeholder: '7 (ej. semana = 7 días)' },
          ]}
          emptyMsg="No hay tipos de alquiler configurados"
          emptyIcon={<Clock size={42} />}
          modalTitle="Tipo de Alquiler"
          readOnly={readOnly}
          hideToolbarAdd
          triggerNew={triggerNew}
        />
      )}
    </div>
  );
}
