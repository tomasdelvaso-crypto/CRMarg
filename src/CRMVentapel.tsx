import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { Plus, Search, DollarSign, TrendingUp, User, Target, Eye, ShoppingCart, Edit3, Save, X, AlertCircle, BarChart3, Package, Factory, ChevronRight, Check, Trash2, CheckCircle, XCircle, ChevronDown, ChevronUp, Clock, Calendar, Users, Brain } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import AIAssistant from './AIAssistant';

// --- CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- TIPOS E INTERFACES ---
interface Escala {
  score: number;
  description: string;
}

interface Escalas {
  dor: Escala;
  poder: Escala;
  visao: Escala;
  valor: Escala;
  controle: Escala;
  compras: Escala;
}

interface Oportunidad {
  id: string; // Cambiado de number a string para UUID
  name: string;
  client: string;
  vendor: string;
  value: number;
  stage: number;
  priority: string;
  created_at: string;
  last_update: string;
  next_action?: string;
  probability: number;
  expected_close?: string;
  product?: string;
  power_sponsor?: string;
  sponsor?: string;
  influencer?: string;
  support_contact?: string;
  scales: Escalas;
  industry?: string;
}

interface DatosFormularioOportunidad {
  name: string;
  client: string;
  vendor: string;
  value: string;
  stage: number;
  priority: string;
  expected_close?: string;
  next_action?: string;
  product?: string;
  power_sponsor?: string;
  sponsor?: string;
  influencer?: string;
  support_contact?: string;
  scales: Escalas;
  industry?: string;
}

interface RequisitoEtapa {
  id: number;
  name: string;
  probability: number;
  color: string;
  requirements: string[];
  checklist?: Record<string, string>;
}

interface InfoVendedor {
  name: string;
  email?: string;
  role?: string;
  is_admin?: boolean;
}

// --- UTILIDADES ---
const escalasVacias = (): Escalas => ({
  dor: { score: 0, description: '' },
  poder: { score: 0, description: '' },
  visao: { score: 0, description: '' },
  valor: { score: 0, description: '' },
  controle: { score: 0, description: '' },
  compras: { score: 0, description: '' }
});

// Función auxiliar para obtener el valor de una escala
const obtenerPuntajeEscala = (escala: Escala | number | undefined | null): number => {
  if (escala === null || escala === undefined) return 0;
  if (typeof escala === 'number') return escala;
  if (typeof escala === 'object' && 'score' in escala) {
    return typeof escala.score === 'number' ? escala.score : 0;
  }
  return 0;
};

// --- SERVICIO API MEJORADO ---
class ServicioSupabase {
  async obtenerOportunidades(): Promise<Oportunidad[]> {
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .order('value', { ascending: false });

      if (error) throw error;

      // Normalizar datos - asegurar que scales siempre tenga el formato correcto
      return (data || []).map(opp => ({
        ...opp,
        scales: this.normalizarEscalas(opp.scales),
        value: Number(opp.value) || 0,
        probability: Number(opp.probability) || 0
      }));
    } catch (error) {
      console.error('Error al obtener oportunidades:', error);
      throw error;
    }
  }

  async obtenerVendedores(): Promise<InfoVendedor[]> {
    try {
      // Primero intentar tabla vendors
      const { data: datosVendedores, error: errorVendedores } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true);

      if (datosVendedores && datosVendedores.length > 0) {
        return datosVendedores;
      }

      // Si no hay tabla vendors, obtener únicos de opportunities
      const { data: datosOps, error: errorOps } = await supabase
        .from('opportunities')
        .select('vendor');

      if (errorOps) throw errorOps;

      const vendedoresUnicos = [...new Set(datosOps?.map(o => o.vendor).filter(Boolean) || [])];
      
      return vendedoresUnicos.map(name => ({
        name,
        role: this.obtenerRolVendedor(name),
        is_admin: name === 'Tomás'
      }));
    } catch (error) {
      console.error('Error al obtener vendedores:', error);
      // Fallback a lista por defecto
      return ['Tomás', 'Jordi', 'Matheus', 'Carlos', 'Paulo'].map(name => ({
        name,
        role: this.obtenerRolVendedor(name),
        is_admin: name === 'Tomás'
      }));
    }
  }

  private obtenerRolVendedor(name: string): string {
    const roles: Record<string, string> = {
      'Tomás': 'CEO/Jefe de Ventas',
      'Jordi': 'Gerente de Ventas',
      'Matheus': 'Ejecutivo de Cuentas'
    };
    return roles[name] || 'Vendedor';
  }

  private normalizarEscalas(escalas: any): Escalas {
    // Si escalas es null, undefined o no es un objeto, retornar estructura vacía
    if (!escalas || typeof escalas !== 'object') {
      return escalasVacias();
    }

    // Intentar normalizar desde diferentes formatos
    try {
      // Si ya tiene el formato correcto
      if (escalas.dor && typeof escalas.dor === 'object' && 'score' in escalas.dor) {
        return escalas;
      }

      // Si tiene formato antiguo con valores numéricos directos
      if (typeof escalas.dor === 'number' || typeof escalas.pain === 'number') {
        return {
          dor: { score: escalas.dor || escalas.pain || 0, description: '' },
          poder: { score: escalas.poder || escalas.power || 0, description: '' },
          visao: { score: escalas.visao || escalas.vision || 0, description: '' },
          valor: { score: escalas.valor || escalas.value || 0, description: '' },
          controle: { score: escalas.controle || escalas.control || 0, description: '' },
          compras: { score: escalas.compras || escalas.purchase || 0, description: '' }
        };
      }
    } catch (e) {
      console.error('Error normalizando escalas:', e);
    }

    return escalasVacias();
  }

  async insertarOportunidad(datos: Omit<Oportunidad, 'id' | 'created_at'>): Promise<Oportunidad> {
    try {
      const { data: resultado, error } = await supabase
        .from('opportunities')
        .insert([datos])
        .select()
        .single();

      if (error) throw error;
      return resultado;
    } catch (error) {
      console.error('Error al insertar oportunidad:', error);
      throw error;
    }
  }

  async actualizarOportunidad(id: string, datos: Partial<Oportunidad>): Promise<Oportunidad> {
    try {
      const { data: resultado, error } = await supabase
        .from('opportunities')
        .update(datos)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return resultado;
    } catch (error) {
      console.error('Error al actualizar oportunidad:', error);
      throw error;
    }
  }

  async eliminarOportunidad(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error al eliminar oportunidad:', error);
      throw error;
    }
  }
}

const servicioSupabase = new ServicioSupabase();

// --- COMPONENTE PuntajeSaludOportunidad ---
const PuntajeSaludOportunidad: React.FC<{ oportunidad: Oportunidad }> = ({ oportunidad }) => {
  const calcularPuntajeSalud = () => {
    if (!oportunidad.scales) return 0;
    
    const puntajes = [
      obtenerPuntajeEscala(oportunidad.scales.dor),
      obtenerPuntajeEscala(oportunidad.scales.poder),
      obtenerPuntajeEscala(oportunidad.scales.visao),
      obtenerPuntajeEscala(oportunidad.scales.valor),
      obtenerPuntajeEscala(oportunidad.scales.controle),
      obtenerPuntajeEscala(oportunidad.scales.compras)
    ];
    
    const promedio = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;
    return Math.round(promedio);
  };
  
  const puntaje = calcularPuntajeSalud();
  const obtenerColor = () => {
    if (puntaje >= 7) return 'text-green-600';
    if (puntaje >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <span className={`font-bold ${obtenerColor()}`}>
      ♥ {puntaje}/10
    </span>
  );
};

// --- DEFINICIONES DE ETAPAS Y ESCALAS ---
const etapas: RequisitoEtapa[] = [
  { 
    id: 1, 
    name: 'Prospección', 
    probability: 0, 
    color: 'bg-gray-500',
    requirements: ['Identificar dolor del cliente', 'Contacto inicial establecido'],
    checklist: {
      'Identificó la empresa potencial': 'empresa_identificada',
      'Investigó sobre el negocio del cliente': 'investigacion_negocio',
      'Identificó persona de contacto': 'contacto_identificado',
      'Realizó primer contacto': 'primer_contacto'
    }
  },
  { 
    id: 2, 
    name: 'Calificación', 
    probability: 20, 
    color: 'bg-blue-500',
    requirements: ['Puntaje DOLOR ≥ 5', 'Puntaje PODER ≥ 4', 'Presupuesto confirmado'],
    checklist: {
      'Cliente admite tener problema/dolor (DOLOR ≥ 5)': 'dolor_admitido',
      'Identificó tomador de decisión (PODER ≥ 4)': 'decisor_identificado',
      'Presupuesto disponible confirmado': 'presupuesto_confirmado',
      'Cronograma del proyecto definido': 'cronograma_definido',
      'Criterios de decisión entendidos': 'criterios_entendidos'
    }
  },
  { 
    id: 3, 
    name: 'Presentación', 
    probability: 40, 
    color: 'bg-yellow-500',
    requirements: ['Puntaje VISIÓN ≥ 5', 'Presentación agendada', 'Partes interesadas definidas'],
    checklist: {
      'Visión de solución creada (VISIÓN ≥ 5)': 'vision_creada',
      'Demo/Presentación realizada': 'demo_realizada',
      'Todas las partes interesadas presentes': 'partes_interesadas_presentes',
      'Objeciones principales identificadas': 'objeciones_identificadas',
      'Próximos pasos acordados': 'proximos_pasos'
    }
  },
  { 
    id: 4, 
    name: 'Validación/Prueba', 
    probability: 75, 
    color: 'bg-orange-500',
    requirements: ['Puntaje VALOR ≥ 6', 'Prueba/POC ejecutado', 'ROI validado'],
    checklist: {
      'POC/Prueba iniciado': 'poc_iniciado',
      'Criterios de éxito definidos': 'criterios_exito',
      'ROI calculado y validado (VALOR ≥ 6)': 'roi_validado',
      'Resultados documentados': 'resultados_documentados',
      'Aprobación técnica obtenida': 'aprobacion_tecnica'
    }
  },
  { 
    id: 5, 
    name: 'Negociación', 
    probability: 90, 
    color: 'bg-green-500',
    requirements: ['Puntaje CONTROL ≥ 7', 'Puntaje COMPRAS ≥ 6', 'Propuesta enviada'],
    checklist: {
      'Propuesta comercial enviada': 'propuesta_enviada',
      'Términos negociados (COMPRAS ≥ 6)': 'terminos_negociados',
      'Control del proceso (CONTROL ≥ 7)': 'control_proceso',
      'Aprobación verbal recibida': 'aprobacion_verbal',
      'Contrato en revisión legal': 'revision_legal'
    }
  },
  { 
    id: 6, 
    name: 'Cerrado', 
    probability: 100, 
    color: 'bg-emerald-600',
    requirements: ['Contrato firmado', 'Pago procesado'],
    checklist: {
      'Contrato firmado': 'contrato_firmado',
      'Pedido de compra emitido': 'pedido_compra',
      'Inicio agendado': 'inicio_agendado',
      'Pago procesado': 'pago_procesado'
    }
  }
];

const escalas = [
  { 
    id: 'dor', 
    name: 'DOLOR', 
    icon: AlertCircle, 
    description: 'Dolor identificado y admitido', 
    color: 'text-red-600', 
    bgColor: 'bg-red-50', 
    borderColor: 'border-red-200',
    questions: [
      '¿El cliente admite tener el problema?',
      '¿El problema está costando dinero?', 
      '¿Las consecuencias son medibles?',
      '¿Hay urgencia para resolver?'
    ]
  },
  { 
    id: 'poder', 
    name: 'PODER', 
    icon: User, 
    description: 'Acceso al decisor', 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-50', 
    borderColor: 'border-blue-200',
    questions: [
      '¿Conoce al decisor final?',
      '¿Tiene acceso directo al decisor?',
      '¿El decisor participa en las reuniones?',
      '¿El proceso de decisión está mapeado?'
    ]
  },
  { 
    id: 'visao', 
    name: 'VISIÓN', 
    icon: Eye, 
    description: 'Visión de solución construida', 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-50', 
    borderColor: 'border-purple-200',
    questions: [
      '¿El cliente ve valor en la solución?',
      '¿Los beneficios están claros?',
      '¿La solución resuelve el dolor?',
      '¿El cliente puede visualizar la implementación?'
    ]
  },
  { 
    id: 'valor', 
    name: 'VALOR', 
    icon: DollarSign, 
    description: 'ROI/Beneficios validados', 
    color: 'text-green-600', 
    bgColor: 'bg-green-50', 
    borderColor: 'border-green-200',
    questions: [
      '¿Se calculó el ROI?',
      '¿El cliente está de acuerdo con el ROI?',
      '¿El valor justifica la inversión?',
      '¿Los beneficios son medibles?'
    ]
  },
  { 
    id: 'controle', 
    name: 'CONTROL', 
    icon: Target, 
    description: 'Control del proceso', 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-50', 
    borderColor: 'border-orange-200',
    questions: [
      '¿Usted conduce el proceso?',
      '¿Los próximos pasos están definidos?',
      '¿El cronograma está acordado?',
      '¿Los competidores están identificados?'
    ]
  },
  { 
    id: 'compras', 
    name: 'COMPRAS', 
    description: 'Proceso de compras', 
    icon: ShoppingCart, 
    color: 'text-indigo-600', 
    bgColor: 'bg-indigo-50', 
    borderColor: 'border-indigo-200',
    questions: [
      '¿El proceso de compras está mapeado?',
      '¿El presupuesto está aprobado?',
      '¿Compras está involucrado?',
      '¿Se conoce la documentación necesaria?'
    ]
  }
];

const definicionesEscala = {
  dor: [
    { level: 0, text: "No hay identificación de necesidad o dolor por el cliente" },
    { level: 1, text: "Vendedor asume necesidades del cliente" },
    { level: 2, text: "Persona de contacto admite necesidad" },
    { level: 3, text: "Persona de contacto admite razones y síntomas causadores de dolor" },
    { level: 4, text: "Persona de contacto admite dolor" },
    { level: 5, text: "Vendedor documenta dolor y persona de contacto concuerda" },
    { level: 6, text: "Persona de contacto formaliza necesidades del tomador de decisión" },
    { level: 7, text: "Tomador de decisión admite necesidades" },
    { level: 8, text: "Tomador de decisión admite razones y síntomas causadores de dolor" },
    { level: 9, text: "Tomador de decisión admite dolor" },
    { level: 10, text: "Vendedor documenta dolor y el decisor concuerda" }
  ],
  poder: [
    { level: 0, text: "Tomador de decisión no fue identificado aún" },
    { level: 1, text: "Proceso de decisión revelado por persona de contacto" },
    { level: 2, text: "Tomador de decisión potencial identificado" },
    { level: 3, text: "Pedido de acceso al tomador de decisión concedido por persona de contacto" },
    { level: 4, text: "Tomador de decisión accedido" },
    { level: 5, text: "Tomador de decisión concuerda en explorar oportunidad" },
    { level: 6, text: "Proceso de decisión y compra confirmado por el tomador de decisión" },
    { level: 7, text: "Tomador de decisión concuerda en hacer una prueba de valor" },
    { level: 8, text: "Tomador de decisión concuerda con contenido de la propuesta" },
    { level: 9, text: "Tomador de decisión confirma aprobación verbal" },
    { level: 10, text: "Tomador de decisión aprueba formalmente internamente" }
  ],
  visao: [
    { level: 0, text: "Ninguna visión o visión competidora establecida" },
    { level: 1, text: "Visión de persona de contacto creada en términos de producto" },
    { level: 2, text: "Visión de persona de contacto creada en términos: Situación/Problema/Implicación" },
    { level: 3, text: "Visión diferenciada creada con persona de contacto (SPI)" },
    { level: 4, text: "Visión diferenciada documentada con persona de contacto" },
    { level: 5, text: "Documentación acordada por persona de contacto" },
    { level: 6, text: "Visión del decisor creada en términos de producto" },
    { level: 7, text: "Visión del decisor creada en términos: Situación/Problema/Implicación" },
    { level: 8, text: "Visión diferenciada creada con tomador de decisión (SPIN)" },
    { level: 9, text: "Visión diferenciada documentada con tomador de decisión" },
    { level: 10, text: "Documentación acordada por tomador de decisión" }
  ],
  valor: [
    { level: 0, text: "Persona de contacto explora la solución, pero valor no fue identificado" },
    { level: 1, text: "Vendedor identifica proposición de valor para el negocio" },
    { level: 2, text: "Persona de contacto concuerda en explorar la propuesta de valor" },
    { level: 3, text: "Tomador de decisión concuerda en explorar la propuesta de valor" },
    { level: 4, text: "Criterios para definición de valor establecidos con tomador de decisión" },
    { level: 5, text: "Valor descubierto conducido y visión del tomador de decisión" },
    { level: 6, text: "Análisis de valor conducido por vendedor (demo)" },
    { level: 7, text: "Análisis de valor conducido por persona de contacto (prueba)" },
    { level: 8, text: "Tomador de decisión concuerda con análisis de valor" },
    { level: 9, text: "Conclusión del análisis de valor documentada por el vendedor" },
    { level: 10, text: "Tomador de decisión confirma por escrito conclusiones del análisis" }
  ],
  controle: [
    { level: 0, text: "Ningún seguimiento documentado de conversación con persona de contacto" },
    { level: 1, text: "Primera visión (SPI) enviada para persona de contacto" },
    { level: 2, text: "Primera visión acordada o modificada por persona de contacto (SPIN)" },
    { level: 3, text: "Primera visión enviada para tomador de decisión (SPI)" },
    { level: 4, text: "Primera visión acordada o modificada por tomador de decisión (SPIN)" },
    { level: 5, text: "Vendedor recibe aprobación para explorar valor" },
    { level: 6, text: "Plan de evaluación enviado para tomador de decisión" },
    { level: 7, text: "Tomador de decisión concuerda o modifica la evaluación" },
    { level: 8, text: "Plan de evaluación conducido (cuando aplicable)" },
    { level: 9, text: "Resultado de la evaluación aprobado por el tomador de decisión" },
    { level: 10, text: "Tomador de decisión aprueba propuesta para negociación final" }
  ],
  compras: [
    { level: 0, text: "Proceso de compras desconocido" },
    { level: 1, text: "Proceso de compras aclarado por la persona de contacto" },
    { level: 2, text: "Proceso de compras confirmado por el tomador de decisión" },
    { level: 3, text: "Condiciones comerciales validadas con el cliente" },
    { level: 4, text: "Propuesta presentada para el cliente" },
    { level: 5, text: "Proceso de negociación iniciado con departamento de compras" },
    { level: 6, text: "Condiciones comerciales aprobadas y formalizadas" },
    { level: 7, text: "Contrato firmado" },
    { level: 8, text: "Pedido de compras recibido" },
    { level: 9, text: "Facturación emitida" },
    { level: 10, text: "Pago realizado" }
  ]
};

// --- CONTEXT API ---
interface ContextoOportunidadesTipo {
  oportunidades: Oportunidad[];
  cargando: boolean;
  error: string | null;
  vendedores: InfoVendedor[];
  usuarioActual: string | null;
  establecerUsuarioActual: (usuario: string | null) => void;
  establecerError: (error: string | null) => void;
  cargarOportunidades: () => Promise<void>;
  cargarVendedores: () => Promise<void>;
  crearOportunidad: (datos: DatosFormularioOportunidad) => Promise<boolean>;
  actualizarOportunidad: (id: string, datos: DatosFormularioOportunidad) => Promise<boolean>;
  eliminarOportunidad: (id: string) => Promise<void>;
  moverEtapa: (oportunidad: Oportunidad, nuevaEtapa: number) => Promise<void>;
}

const ContextoOportunidades = createContext<ContextoOportunidadesTipo | null>(null);

const usarContextoOportunidades = () => {
  const contexto = useContext(ContextoOportunidades);
  if (!contexto) {
    throw new Error('usarContextoOportunidades debe ser usado dentro de ProveedorOportunidades');
  }
  return contexto;
};

// --- COMPONENTE PROVEEDOR ---
const ProveedorOportunidades: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [oportunidades, establecerOportunidades] = useState<Oportunidad[]>([]);
  const [vendedores, establecerVendedores] = useState<InfoVendedor[]>([]);
  const [usuarioActual, establecerUsuarioActual] = useState<string | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState<string | null>(null);

  const cargarVendedores = useCallback(async () => {
    try {
      const datosVendedor = await servicioSupabase.obtenerVendedores();
      establecerVendedores(datosVendedor);
      
      if (!usuarioActual) {
        const usuarioGuardado = localStorage.getItem('ventapel_user');
        if (usuarioGuardado && datosVendedor.some(v => v.name === usuarioGuardado)) {
          establecerUsuarioActual(usuarioGuardado);
        } else if (datosVendedor.length > 0) {
          establecerUsuarioActual(datosVendedor[0].name);
        }
      }
    } catch (err) {
      console.error('Error al cargar vendedores:', err);
      establecerError('Error al cargar vendedores');
    }
  }, [usuarioActual]);

  const cargarOportunidades = useCallback(async () => {
    try {
      establecerCargando(true);
      establecerError(null);
      const datos = await servicioSupabase.obtenerOportunidades();
      establecerOportunidades(datos);
    } catch (err) {
      console.error('Error al cargar oportunidades:', err);
      establecerError('Error al cargar oportunidades. Por favor, inténtelo de nuevo.');
      establecerOportunidades([]);
    } finally {
      establecerCargando(false);
    }
  }, []);

  const crearOportunidad = useCallback(async (datosFormulario: DatosFormularioOportunidad): Promise<boolean> => {
    try {
      establecerError(null);
      
      // Validación básica
      if (!datosFormulario.name?.trim() || !datosFormulario.client?.trim() || !datosFormulario.value) {
        establecerError('Por favor, complete los campos obligatorios: Nombre, Cliente y Valor');
        return false;
      }
      
      // Asegurar que scales NUNCA sea null o undefined
      let escalasSeguras = datosFormulario.scales;
      if (!escalasSeguras || typeof escalasSeguras !== 'object') {
        console.warn('⚠️ Escalas inválidas, usando valores por defecto');
        escalasSeguras = escalasVacias();
      }
      
      // Construir el objeto para insertar
      const nuevaOportunidad = {
        name: datosFormulario.name.trim(),
        client: datosFormulario.client.trim(),
        vendor: datosFormulario.vendor || usuarioActual || 'Tomás',
        value: parseFloat(datosFormulario.value.toString()) || 0,
        stage: parseInt(datosFormulario.stage?.toString() || '1'),
        priority: datosFormulario.priority || 'media',
        probability: etapas.find(s => s.id === (parseInt(datosFormulario.stage?.toString() || '1')))?.probability || 0,
        last_update: new Date().toISOString().split('T')[0],
        scales: escalasSeguras,
        expected_close: datosFormulario.expected_close || null,
        next_action: datosFormulario.next_action?.trim() || null,
        product: datosFormulario.product?.trim() || null,
        power_sponsor: datosFormulario.power_sponsor?.trim() || null,
        sponsor: datosFormulario.sponsor?.trim() || null,
        influencer: datosFormulario.influencer?.trim() || null,
        support_contact: datosFormulario.support_contact?.trim() || null,
        industry: datosFormulario.industry?.trim() || null
      };

      console.log('📝 Intentando crear oportunidad:', nuevaOportunidad);
      await servicioSupabase.insertarOportunidad(nuevaOportunidad);
      await cargarOportunidades();
      return true;
      
    } catch (err: any) {
      console.error('❌ Error al crear oportunidad:', err);
      establecerError(`Error al crear oportunidad: ${err.message || 'Verifique los datos'}`);
      return false;
    }
  }, [cargarOportunidades, usuarioActual]);

  const actualizarOportunidad = useCallback(async (id: string, datosFormulario: DatosFormularioOportunidad): Promise<boolean> => {
    try {
      establecerError(null);
      
      // Asegurar que scales NUNCA sea null
      let escalasSeguras = datosFormulario.scales;
      if (!escalasSeguras || typeof escalasSeguras !== 'object') {
        console.warn('⚠️ Escalas inválidas en actualización, usando valores por defecto');
        escalasSeguras = escalasVacias();
      }
      
      const datosActualizados = {
        name: datosFormulario.name.trim(),
        client: datosFormulario.client.trim(),
        vendor: datosFormulario.vendor || usuarioActual || 'Tomás',
        value: parseFloat(datosFormulario.value.toString()) || 0,
        stage: parseInt(datosFormulario.stage?.toString() || '1'),
        priority: datosFormulario.priority || 'media',
        probability: etapas.find(s => s.id === (parseInt(datosFormulario.stage?.toString() || '1')))?.probability || 0,
        last_update: new Date().toISOString().split('T')[0],
        scales: escalasSeguras,
        expected_close: datosFormulario.expected_close || null,
        next_action: datosFormulario.next_action?.trim() || null,
        product: datosFormulario.product?.trim() || null,
        power_sponsor: datosFormulario.power_sponsor?.trim() || null,
        sponsor: datosFormulario.sponsor?.trim() || null,
        influencer: datosFormulario.influencer?.trim() || null,
        support_contact: datosFormulario.support_contact?.trim() || null,
        industry: datosFormulario.industry?.trim() || null
      };

      console.log('📝 Actualizando oportunidad:', datosActualizados);
      await servicioSupabase.actualizarOportunidad(id, datosActualizados);
      await cargarOportunidades();
      return true;
      
    } catch (err: any) {
      console.error('❌ Error al actualizar oportunidad:', err);
      establecerError(`Error al actualizar: ${err.message || 'Verifique los datos'}`);
      return false;
    }
  }, [cargarOportunidades, usuarioActual]);

  const eliminarOportunidad = useCallback(async (id: string): Promise<void> => {
    if (!confirm('¿Está seguro de que desea eliminar esta oportunidad?')) {
      return;
    }

    try {
      establecerError(null);
      await servicioSupabase.eliminarOportunidad(id);
      establecerOportunidades(prev => prev.filter(opp => opp.id !== id));
    } catch (err) {
      console.error('Error al eliminar oportunidad:', err);
      establecerError('Error al eliminar oportunidad. Por favor, inténtelo de nuevo.');
      await cargarOportunidades();
    }
  }, [cargarOportunidades]);

  const moverEtapa = useCallback(async (oportunidad: Oportunidad, nuevaEtapa: number): Promise<void> => {
    const etapa = etapas.find(s => s.id === nuevaEtapa);
    if (!etapa) {
      console.error('Etapa no encontrada:', nuevaEtapa);
      return;
    }

    try {
      establecerError(null);
      
      const datosActualizados = {
        stage: nuevaEtapa,
        probability: etapa.probability,
        last_update: new Date().toISOString().split('T')[0]
      };

      await servicioSupabase.actualizarOportunidad(oportunidad.id, datosActualizados);
      
      establecerOportunidades(prev => prev.map(opp => 
        opp.id === oportunidad.id 
          ? { ...opp, ...datosActualizados }
          : opp
      ));
    } catch (err) {
      console.error('Error al mover etapa:', err);
      establecerError('Error al actualizar etapa. Por favor, inténtelo de nuevo.');
      await cargarOportunidades();
    }
  }, [cargarOportunidades]);

  useEffect(() => {
    cargarVendedores();
    cargarOportunidades();

    // Suscribirse a cambios en tiempo real
    const suscripcion = supabase
      .channel('cambios-oportunidades')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'opportunities' },
        (carga) => {
          console.log('Cambio detectado:', carga);
          cargarOportunidades();
        }
      )
      .subscribe();

    return () => {
      suscripcion.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (usuarioActual) {
      localStorage.setItem('ventapel_user', usuarioActual);
    }
  }, [usuarioActual]);

  const valor = useMemo(() => ({
    oportunidades,
    cargando,
    error,
    vendedores,
    usuarioActual,
    establecerUsuarioActual,
    establecerError,
    cargarOportunidades,
    cargarVendedores,
    crearOportunidad,
    actualizarOportunidad,
    eliminarOportunidad,
    moverEtapa
  }), [oportunidades, cargando, error, vendedores, usuarioActual, cargarOportunidades, cargarVendedores, crearOportunidad, actualizarOportunidad, eliminarOportunidad, moverEtapa]);

  return (
    <ContextoOportunidades.Provider value={valor}>
      {children}
    </ContextoOportunidades.Provider>
  );
};

// --- HOOKS UTILITARIOS ---
const usarFiltros = () => {
  const [terminoBusqueda, establecerTerminoBusqueda] = useState('');
  const [filtroEtapa, establecerFiltroEtapa] = useState('all');
  const [filtroVendedor, establecerFiltroVendedor] = useState('all');
  const [filtroInactividad, establecerFiltroInactividad] = useState('all');

  return {
    terminoBusqueda,
    establecerTerminoBusqueda,
    filtroEtapa,
    establecerFiltroEtapa,
    filtroVendedor,
    establecerFiltroVendedor,
    filtroInactividad,
    establecerFiltroInactividad
  };
};

// --- COMPONENTES ---
const AlertaError: React.FC<{ error: string; alCerrar: () => void }> = ({ error, alCerrar }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-center">
      <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
      <span className="text-red-800">{error}</span>
      <button onClick={alCerrar} className="ml-auto text-red-600 hover:text-red-800">
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const SpinnerCarga: React.FC = () => (
  <div className="text-center py-12 bg-white rounded-xl border">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
    <p className="mt-4 text-gray-600">Cargando oportunidades...</p>
  </div>
);

// --- FUNCIONES AUXILIARES ---
const verificarRequisitosEtapa = (oportunidad: Oportunidad, idEtapa: number): boolean => {
  // Si no hay escalas, no cumple requisitos
  if (!oportunidad.scales) return false;

  // Asegurar que escalas es un objeto válido
  const escalasOportunidad = oportunidad.scales || escalasVacias();

  switch (idEtapa) {
    case 2:
      return obtenerPuntajeEscala(escalasOportunidad.dor) >= 5 && 
             obtenerPuntajeEscala(escalasOportunidad.poder) >= 4;
    case 3:
      return obtenerPuntajeEscala(escalasOportunidad.visao) >= 5;
    case 4:
      return obtenerPuntajeEscala(escalasOportunidad.valor) >= 6;
    case 5:
      return obtenerPuntajeEscala(escalasOportunidad.controle) >= 7 && 
             obtenerPuntajeEscala(escalasOportunidad.compras) >= 6;
    default:
      return true;
  }
};

const verificarInactividad = (ultimaActualizacion: string, dias: number): boolean => {
  const fechaActualizacion = new Date(ultimaActualizacion);
  const hoy = new Date();
  const diferenciaTiempo = Math.abs(hoy.getTime() - fechaActualizacion.getTime());
  const diferenciaDias = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));
  return diferenciaDias >= dias;
};

// --- COMPONENTE PRINCIPAL ---
const CRMVentapel: React.FC = () => {
  const [pestanaActiva, establecerPestanaActiva] = useState('tablero');
  const [mostrarNuevaOportunidad, establecerMostrarNuevaOportunidad] = useState(false);
  const [oportunidadEditando, establecerOportunidadEditando] = useState<Oportunidad | null>(null);
  const [oportunidadSeleccionada, establecerOportunidadSeleccionada] = useState<Oportunidad | null>(null);
  const [filtroVendedorTablero, establecerFiltroVendedorTablero] = useState('all');
  const [etapaSeleccionadaParaLista, establecerEtapaSeleccionadaParaLista] = useState<number | null>(null);
  const [mostrarChecklistEtapa, establecerMostrarChecklistEtapa] = useState<{ oportunidad: Oportunidad, etapaObjetivo: number } | null>(null);
  const [asistenteChatAbierto, establecerAsistenteChatAbierto] = useState(false);

  const { 
    oportunidades, 
    cargando, 
    error, 
    vendedores,
    usuarioActual,
    establecerUsuarioActual,
    establecerError, 
    crearOportunidad, 
    actualizarOportunidad, 
    eliminarOportunidad, 
    moverEtapa 
  } = usarContextoOportunidades();
  
  const filtros = usarFiltros();

  // Obtener información del vendedor actual
  const infoVendedorActual = useMemo(() => {
    return vendedores.find(v => v.name === usuarioActual) || null;
  }, [vendedores, usuarioActual]);

  // Filtrar oportunidades según el usuario actual
  const oportunidadesUsuario = useMemo(() => {
    if (!usuarioActual) return oportunidades;
    if (infoVendedorActual?.is_admin) return oportunidades;
    return oportunidades.filter(opp => opp.vendor === usuarioActual);
  }, [oportunidades, usuarioActual, infoVendedorActual]);

  const oportunidadesFiltradas = useMemo(() => {
    return oportunidadesUsuario.filter(opp => {
      const coincideBusqueda = opp.name.toLowerCase().includes(filtros.terminoBusqueda.toLowerCase()) ||
                           opp.client.toLowerCase().includes(filtros.terminoBusqueda.toLowerCase()) ||
                           (opp.product && opp.product.toLowerCase().includes(filtros.terminoBusqueda.toLowerCase()));
      const coincideEtapa = filtros.filtroEtapa === 'all' || opp.stage.toString() === filtros.filtroEtapa;
      const coincideVendedor = filtros.filtroVendedor === 'all' || opp.vendor === filtros.filtroVendedor;
      
      let coincideInactividad = true;
      if (filtros.filtroInactividad === '7days') {
        coincideInactividad = verificarInactividad(opp.last_update, 7);
      } else if (filtros.filtroInactividad === '30days') {
        coincideInactividad = verificarInactividad(opp.last_update, 30);
      }
      
      return coincideBusqueda && coincideEtapa && coincideVendedor && coincideInactividad;
    });
  }, [oportunidadesUsuario, filtros.terminoBusqueda, filtros.filtroEtapa, filtros.filtroVendedor, filtros.filtroInactividad]);

  const oportunidadesTablero = useMemo(() => {
    const oportunidadesBase = infoVendedorActual?.is_admin ? oportunidades : oportunidadesUsuario;
    if (filtroVendedorTablero === 'all') return oportunidadesBase;
    return oportunidadesBase.filter(opp => opp.vendor === filtroVendedorTablero);
  }, [oportunidades, oportunidadesUsuario, filtroVendedorTablero, infoVendedorActual]);

  const metricas = useMemo(() => ({
    valorTotal: oportunidadesTablero.reduce((suma, opp) => suma + (opp.value || 0), 0),
    valorPonderado: oportunidadesTablero.reduce((suma, opp) => suma + ((opp.value || 0) * (opp.probability || 0) / 100), 0),
    oportunidadesTotales: oportunidadesTablero.length,
    puntajePromedio: oportunidadesTablero.length > 0 ? 
      oportunidadesTablero.reduce((suma, opp) => {
        if (!opp.scales) return suma;
        const puntajesEscala = [
          obtenerPuntajeEscala(opp.scales.dor),
          obtenerPuntajeEscala(opp.scales.poder),
          obtenerPuntajeEscala(opp.scales.visao),
          obtenerPuntajeEscala(opp.scales.valor),
          obtenerPuntajeEscala(opp.scales.controle),
          obtenerPuntajeEscala(opp.scales.compras)
        ];
        const promedioPuntajeOpp = puntajesEscala.reduce((a, b) => a + b, 0) / puntajesEscala.length;
        return suma + promedioPuntajeOpp;
      }, 0) / oportunidadesTablero.length : 0,
    probabilidadPromedio: oportunidadesTablero.length > 0 ?
      oportunidadesTablero.reduce((suma, opp) => suma + (opp.probability || 0), 0) / oportunidadesTablero.length : 0,
    distribucionEtapas: etapas.map(etapa => ({
      ...etapa,
      cantidad: oportunidadesTablero.filter(opp => opp.stage === etapa.id).length,
      valor: oportunidadesTablero.filter(opp => opp.stage === etapa.id).reduce((suma, opp) => suma + (opp.value || 0), 0),
      valorPonderado: oportunidadesTablero.filter(opp => opp.stage === etapa.id).reduce((suma, opp) => suma + ((opp.value || 0) * (opp.probability || 0) / 100), 0),
      oportunidades: oportunidadesTablero.filter(opp => opp.stage === etapa.id)
    }))
  }), [oportunidadesTablero]);

  const abrirAsistenteConOportunidad = useCallback((oportunidad: Oportunidad) => {
    establecerOportunidadSeleccionada(oportunidad);
    establecerAsistenteChatAbierto(true);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('abrirAsistente'));
    }, 100);
  }, []);

  const manejarMoverEtapa = useCallback(async (oportunidad: Oportunidad, nuevaEtapa: number) => {
    if (nuevaEtapa > oportunidad.stage && !verificarRequisitosEtapa(oportunidad, oportunidad.stage)) {
      establecerMostrarChecklistEtapa({ oportunidad, etapaObjetivo: nuevaEtapa });
      return;
    }
    
    await moverEtapa(oportunidad, nuevaEtapa);
  }, [moverEtapa]);

  // --- COMPONENTES INTERNOS ---
  const Tablero = () => (
    <div className="space-y-8">
      {error && <AlertaError error={error} alCerrar={() => establecerError(null)} />}

      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">🎯 CRM Ventapel Brasil</h2>
            <p className="text-blue-100">Sistema de Ventas Consultivas - Metodología PPVVCC</p>
            <p className="text-blue-100 text-sm">🔗 Conectado a Supabase</p>
            {usuarioActual && (
              <p className="text-yellow-300 text-sm mt-1">
                👤 {usuarioActual} {infoVendedorActual?.role && `(${infoVendedorActual.role})`}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">R$ {metricas.valorTotal.toLocaleString('es-AR')}</div>
            <div className="text-blue-100">Pipeline Total</div>
            <div className="text-lg font-semibold text-yellow-300 mt-1">
              R$ {metricas.valorPonderado.toLocaleString('es-AR')} ponderado
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl shadow-sm border border-green-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-700">Pipeline Total</p>
              <p className="text-2xl font-bold text-green-800">
                R$ {metricas.valorTotal.toLocaleString('es-AR')}
              </p>
              <p className="text-sm text-green-600">
                Ponderado: R$ {metricas.valorPonderado.toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl shadow-sm border border-blue-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Target className="w-8 h-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-700">Oportunidades</p>
              <p className="text-2xl font-bold text-blue-800">{metricas.oportunidadesTotales}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl shadow-sm border border-purple-200">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-purple-700">Puntaje PPVVCC</p>
              <p className="text-2xl font-bold text-purple-800">{metricas.puntajePromedio.toFixed(1)}/10</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-xl shadow-sm border border-orange-200">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-orange-700">Probabilidad Media</p>
              <p className="text-2xl font-bold text-orange-800">{metricas.probabilidadPromedio.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-800">📊 Embudo de Ventas</h3>
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Filtrar por vendedor:</label>
            <select
              value={filtroVendedorTablero}
              onChange={(e) => establecerFiltroVendedorTablero(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!infoVendedorActual?.is_admin && Boolean(usuarioActual)}
            >
              <option value="all">👥 Todos los vendedores</option>
              {vendedores.map(vendedor => (
                <option key={vendedor.name} value={vendedor.name}>
                  {vendedor.name} {vendedor.role && `(${vendedor.role})`}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="space-y-4">
          {metricas.distribucionEtapas.slice(0, 5).map(etapa => (
            <div key={etapa.id}>
              <div 
                className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                onClick={() => establecerEtapaSeleccionadaParaLista(etapaSeleccionadaParaLista === etapa.id ? null : etapa.id)}
              >
                <div className="w-32 text-sm font-medium text-gray-700">{etapa.name}</div>
                <div className="flex-1 mx-6">
                  <div className="bg-gray-200 rounded-full h-8 relative">
                    <div 
                      className={etapa.color + ' h-8 rounded-full transition-all duration-500'}
                      style={{ width: Math.max((etapa.cantidad / Math.max(...metricas.distribucionEtapas.map(s => s.cantidad), 1)) * 100, 5) + '%' }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white">
                      {etapa.cantidad > 0 && etapa.cantidad + ' oportunidades'}
                    </div>
                  </div>
                </div>
                <div className="w-20 text-sm text-gray-600 text-center">{etapa.cantidad}</div>
                <div className="w-40 text-sm font-medium text-right text-gray-800">
                  R$ {etapa.valor.toLocaleString('es-AR')}
                </div>
                <div className="w-40 text-sm text-right text-gray-600">
                  Pond: R$ {etapa.valorPonderado.toLocaleString('es-AR')}
                </div>
                <ChevronDown className={'w-5 h-5 ml-4 text-gray-400 transition-transform ' + (etapaSeleccionadaParaLista === etapa.id ? 'rotate-180' : '')} />
              </div>
              
              {etapaSeleccionadaParaLista === etapa.id && etapa.oportunidades.length > 0 && (
                <div className="mt-4 ml-8 mr-8 p-4 bg-gray-50 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-200">
                        <th className="pb-2 font-medium text-gray-700">Oportunidad</th>
                        <th className="pb-2 font-medium text-gray-700">Cliente</th>
                        <th className="pb-2 font-medium text-gray-700">Vendedor</th>
                        <th className="pb-2 font-medium text-gray-700 text-right">Valor</th>
                        <th className="pb-2 font-medium text-gray-700 text-right">Prob.</th>
                        <th className="pb-2 font-medium text-gray-700 text-right">Valor Pond.</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {etapa.oportunidades.map(opp => (
                        <tr key={opp.id} className="border-b border-gray-100 hover:bg-white cursor-pointer">
                          <td className="py-2">{opp.name}</td>
                          <td className="py-2">{opp.client}</td>
                          <td className="py-2">{opp.vendor}</td>
                          <td className="py-2 text-right">R$ {opp.value.toLocaleString('es-AR')}</td>
                          <td className="py-2 text-right">{opp.probability}%</td>
                          <td className="py-2 text-right font-medium">
                            R$ {(opp.value * opp.probability / 100).toLocaleString('es-AR')}
                          </td>
                          <td className="py-2">
                            <div className="flex space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  establecerOportunidadSeleccionada(opp);
                                  establecerOportunidadEditando(opp);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirAsistenteConOportunidad(opp);
                                }}
                                className="text-purple-600 hover:text-purple-800"
                                title="Analizar con Coach IA"
                              >
                                <Brain className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-lg font-semibold text-gray-800">
              Total General:
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900">
                R$ {metricas.valorTotal.toLocaleString('es-AR')}
              </div>
              <div className="text-sm text-gray-600">
                Ponderado: R$ {metricas.valorPonderado.toLocaleString('es-AR')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const TarjetaOportunidad: React.FC<{ oportunidad: Oportunidad }> = ({ oportunidad }) => {
    const etapa = etapas.find(s => s.id === oportunidad.stage);
    const etapaSiguiente = etapas.find(s => s.id === oportunidad.stage + 1);
    const etapaAnterior = etapas.find(s => s.id === oportunidad.stage - 1);
    
    const puntajePromedio = oportunidad.scales ? 
      [
        obtenerPuntajeEscala(oportunidad.scales.dor),
        obtenerPuntajeEscala(oportunidad.scales.poder),
        obtenerPuntajeEscala(oportunidad.scales.visao),
        obtenerPuntajeEscala(oportunidad.scales.valor),
        obtenerPuntajeEscala(oportunidad.scales.controle),
        obtenerPuntajeEscala(oportunidad.scales.compras)
      ].reduce((a, b) => a + b, 0) / 6 : 0;

    const puedeAvanzar = etapaSiguiente && verificarRequisitosEtapa(oportunidad, oportunidad.stage);
    const inactiva7Dias = verificarInactividad(oportunidad.last_update, 7);
    const inactiva30Dias = verificarInactividad(oportunidad.last_update, 30);

    return (
      <div className={'bg-white rounded-xl shadow-sm border p-6 hover:shadow-lg transition-all ' + 
        (inactiva30Dias ? 'border-red-300 bg-red-50' : inactiva7Dias ? 'border-yellow-300 bg-yellow-50' : '')}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-xl font-bold text-gray-900">{oportunidad.name}</h3>
              <PuntajeSaludOportunidad oportunidad={oportunidad} />
              {inactiva30Dias && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  +30 días sin movimiento
                </span>
              )} 
              {!inactiva30Dias && inactiva7Dias && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  +7 días sin movimiento
                </span>
              )}
              <button
                onClick={() => {
                  establecerOportunidadEditando(oportunidad);
                  establecerOportunidadSeleccionada(oportunidad);
                }}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Editar oportunidad"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => abrirAsistenteConOportunidad(oportunidad)}
                className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                title="Analizar con Coach IA"
              >
                <Brain className="w-4 h-4" />
              </button>
              <button
                onClick={() => eliminarOportunidad(oportunidad.id)}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar oportunidad"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-blue-600">{oportunidad.client}</p>
              <p className="text-sm text-gray-600">👤 {oportunidad.vendor}</p>
              <p className="text-sm text-purple-600">📦 {oportunidad.product}</p>
              {oportunidad.industry && (
                <p className="text-sm text-gray-600">🏭 {oportunidad.industry}</p>
              )}
              {oportunidad.expected_close && (
                <p className="text-sm text-gray-600">📅 Cierre: {new Date(oportunidad.expected_close).toLocaleDateString('es-AR')}</p>
              )}
            </div>
            {oportunidad.next_action && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">📅 <strong>Próxima acción:</strong> {oportunidad.next_action}</p>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              Última actualización: {new Date(oportunidad.last_update).toLocaleDateString('es-AR')}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600 mb-2">
              R$ {(oportunidad.value || 0).toLocaleString('es-AR')}
            </p>
            <span className={'inline-block px-4 py-2 rounded-full text-sm font-bold text-white ' + (etapa?.color || '') + ' mb-2'}>
              {etapa?.name} ({oportunidad.probability || 0}%)
            </span>
            <p className="text-sm text-gray-600 font-medium">
              Ponderado: R$ {((oportunidad.value || 0) * (oportunidad.probability || 0) / 100).toLocaleString('es-AR')}
            </p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-700">🎯 Gestión de Etapa</h4>
            <div className="flex space-x-2">
              {etapaAnterior && (
                <button
                  onClick={() => manejarMoverEtapa(oportunidad, etapaAnterior.id)}
                  className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  ← {etapaAnterior.name}
                </button>
              )}
              {etapaSiguiente && (
                <button
                  onClick={() => manejarMoverEtapa(oportunidad, etapaSiguiente.id)}
                  className={'px-3 py-1 text-xs rounded-md transition-colors flex items-center ' + (puedeAvanzar 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-red-100 text-red-600 cursor-not-allowed')}
                >
                  {etapaSiguiente.name} →
                  {puedeAvanzar ? <Check className="w-3 h-3 ml-1" /> : <X className="w-3 h-3 ml-1" />}
                </button>
              )}
            </div>
          </div>
          
          {etapaSiguiente && (
            <div className="text-xs text-gray-600">
              <p className="font-medium mb-1">Requisitos para {etapaSiguiente.name}:</p>
              <ul className="space-y-1">
                {etapaSiguiente.requirements?.map((req, idx) => (
                  <li key={idx} className="flex items-center">
                    <div className={'w-2 h-2 rounded-full mr-2 ' + (verificarRequisitosEtapa(oportunidad, oportunidad.stage) ? 'bg-green-500' : 'bg-red-500')}></div>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-gray-700">📊 Puntaje PPVVCC General</span>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-gray-900">{puntajePromedio.toFixed(1)}/10</span>
              {oportunidadSeleccionada?.id === oportunidad.id && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center">
                  <Brain className="w-3 h-3 mr-1" />
                  En análisis
                </span>
              )}
            </div>
          </div>
          <div className="bg-gray-200 rounded-full h-4 mb-4">
            <div 
              className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-4 rounded-full transition-all duration-500"
              style={{ width: (puntajePromedio / 10) * 100 + '%' }}
            ></div>
          </div>
          
          {oportunidad.scales && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {escalas.map(escala => {
                const Icono = escala.icon;
                const datosEscala = oportunidad.scales[escala.id as keyof Escalas];
                const valorPuntaje = obtenerPuntajeEscala(datosEscala);
                return (
                  <div key={escala.id} className={escala.bgColor + ' ' + escala.borderColor + ' border-2 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all'}
                       onClick={() => {
                         establecerOportunidadEditando(oportunidad);
                         establecerOportunidadSeleccionada(oportunidad);
                       }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <Icono className={'w-4 h-4 mr-2 ' + escala.color} />
                        <span className="text-xs font-bold">{escala.name}</span>
                      </div>
                      <span className="text-lg font-bold text-gray-800">{valorPuntaje}</span>
                    </div>
                    {datosEscala.description && (
                      <p className="text-xs text-gray-600 mt-1">{datosEscala.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sección de Contactos */}
        <div className="border-t pt-4">
          <h4 className="font-semibold text-gray-700 mb-3">👥 Contactos Principales</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
            {oportunidad.power_sponsor && (
              <div className="flex items-center">
                <span className="font-medium text-gray-600 mr-2">Patrocinador Poder:</span>
                <span className="text-gray-800">{oportunidad.power_sponsor}</span>
              </div>
            )}
            {oportunidad.sponsor && (
              <div className="flex items-center">
                <span className="font-medium text-gray-600 mr-2">Patrocinador:</span>
                <span className="text-gray-800">{oportunidad.sponsor}</span>
              </div>
            )}
            {oportunidad.influencer && (
              <div className="flex items-center">
                <span className="font-medium text-gray-600 mr-2">Influenciador:</span>
                <span className="text-gray-800">{oportunidad.influencer}</span>
              </div>
            )}
            {oportunidad.support_contact && (
              <div className="flex items-center">
                <span className="font-medium text-gray-600 mr-2">Contacto de Apoyo:</span>
                <span className="text-gray-800">{oportunidad.support_contact}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ListaOportunidades = () => (
    <div className="space-y-6">
      {error && <AlertaError error={error} alCerrar={() => establecerError(null)} />}

      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">🔍 Filtros y Búsqueda</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por cliente, oportunidad o producto..."
                value={filtros.terminoBusqueda}
                onChange={(e) => filtros.establecerTerminoBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <select
              value={filtros.filtroEtapa}
              onChange={(e) => filtros.establecerFiltroEtapa(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">📊 Todas las etapas</option>
              {etapas.slice(0, 5).map(etapa => (
                <option key={etapa.id} value={etapa.id.toString()}>
                  {etapa.name} ({etapa.probability}%)
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filtros.filtroVendedor}
              onChange={(e) => filtros.establecerFiltroVendedor(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!infoVendedorActual?.is_admin}
            >
              <option value="all">👥 Todos los vendedores</option>
              {vendedores.map(vendedor => (
                <option key={vendedor.name} value={vendedor.name}>
                  {vendedor.name} {vendedor.role && `(${vendedor.role})`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filtros.filtroInactividad}
              onChange={(e) => filtros.establecerFiltroInactividad(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">⏰ Todas las actividades</option>
              <option value="7days">🟡 +7 días sin movimiento</option>
              <option value="30days">🔴 +30 días sin movimiento</option>
            </select>
          </div>
          <div>
            <button
              onClick={() => establecerMostrarNuevaOportunidad(true)}
              className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 font-bold transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nueva Oportunidad
            </button>
          </div>
        </div>
      </div>

      {cargando ? (
        <SpinnerCarga />
      ) : (
        <div className="grid gap-6">
          {oportunidadesFiltradas.map(oportunidad => (
            <TarjetaOportunidad key={oportunidad.id} oportunidad={oportunidad} />
          ))}
          {oportunidadesFiltradas.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border">
              <Factory className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron oportunidades</h3>
              <p className="text-gray-600 mb-6">Ajuste los filtros o agregue una nueva oportunidad Ventapel</p>
              <button
                onClick={() => establecerMostrarNuevaOportunidad(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 transition-colors font-bold"
              >
                ➕ Agregar Oportunidad
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  interface PropiedadesFormularioOportunidad {
    oportunidad?: Oportunidad | null;
    alCerrar: () => void;
  }

  const FormularioOportunidad: React.FC<PropiedadesFormularioOportunidad> = ({ oportunidad, alCerrar }) => {
    // Siempre inicializar con un objeto válido de escalas
    const [datosFormulario, establecerDatosFormulario] = useState<DatosFormularioOportunidad>({
      name: oportunidad?.name || '',
      client: oportunidad?.client || '',
      vendor: oportunidad?.vendor || usuarioActual || vendedores[0]?.name || '',
      value: oportunidad?.value?.toString() || '',
      stage: oportunidad?.stage || 1,
      priority: oportunidad?.priority || 'media',
      expected_close: oportunidad?.expected_close || '',
      next_action: oportunidad?.next_action || '',
      product: oportunidad?.product || '',
      power_sponsor: oportunidad?.power_sponsor || '',
      sponsor: oportunidad?.sponsor || '',
      influencer: oportunidad?.influencer || '',
      support_contact: oportunidad?.support_contact || '',
      scales: oportunidad?.scales || escalasVacias(), // Siempre un objeto válido
      industry: oportunidad?.industry || ''
    });

    const [escalaActiva, establecerEscalaActiva] = useState<string | null>(null);
    const [enviando, establecerEnviando] = useState(false);
    const [mostrarSelectorEscala, establecerMostrarSelectorEscala] = useState<string | null>(null);

    const manejarEnvio = async () => {
      // Validaciones mejoradas
      if (!datosFormulario.name?.trim()) {
        alert('❌ Por favor, ingrese el nombre de la oportunidad');
        return;
      }
      
      if (!datosFormulario.client?.trim()) {
        alert('❌ Por favor, ingrese el nombre del cliente');
        return;
      }
      
      const valorNum = parseFloat(datosFormulario.value?.toString() || '0');
      if (isNaN(valorNum) || valorNum <= 0) {
        alert('❌ Por favor, ingrese un valor válido mayor a 0');
        return;
      }

      establecerEnviando(true);
      
      try {
        // Asegurar que scales existe antes de enviar
        const datosParaEnviar = {
          ...datosFormulario,
          scales: datosFormulario.scales || escalasVacias()
        };
        
        const exito = oportunidad 
          ? await actualizarOportunidad(oportunidad.id, datosParaEnviar)
          : await crearOportunidad(datosParaEnviar);
          
        if (exito) {
          alCerrar();
          // Limpiar selección si se editó
          if (oportunidad && oportunidadSeleccionada?.id === oportunidad.id) {
            establecerOportunidadSeleccionada(null);
          }
        }
      } finally {
        establecerEnviando(false);
      }
    };

    const actualizarEscala = (idEscala: string, campo: 'score' | 'description', valor: string | number) => {
      // Validar puntaje entre 0 y 10
      if (campo === 'score') {
        const valorNumerico = typeof valor === 'string' ? parseInt(valor) : valor;
        if (valorNumerico < 0 || valorNumerico > 10) return;
      }
      
      establecerDatosFormulario(prev => ({
        ...prev,
        scales: {
          ...prev.scales,
          [idEscala]: {
            ...prev.scales[idEscala as keyof Escalas],
            [campo]: campo === 'score' ? (typeof valor === 'string' ? parseInt(valor) || 0 : valor) : valor
          }
        }
      }));
    };

    const seleccionarNivelEscala = (idEscala: string, nivel: number, descripcion: string) => {
      actualizarEscala(idEscala, 'score', nivel);
      actualizarEscala(idEscala, 'description', descripcion);
      establecerMostrarSelectorEscala(null);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-xl max-w-6xl w-full my-8">
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  {oportunidad ? '✏️ Editar Oportunidad' : '➕ Nueva Oportunidad'}
                </h2>
                <p className="text-gray-600 mt-1">
                  {oportunidad ? 'Actualice los datos de la oportunidad' : 'Agregue una nueva oportunidad al pipeline Ventapel'}
                </p>
              </div>
              <button 
                onClick={alCerrar}
                className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={enviando}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                  <h3 className="text-lg font-semibold mb-4 text-blue-800">📋 Información Básica</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Nombre de la Oportunidad *</label>
                      <input
                        type="text"
                        value={datosFormulario.name}
                        onChange={(e) => establecerDatosFormulario({...datosFormulario, name: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Solución de Cierre Amazon"
                        disabled={enviando}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Cliente *</label>
                      <input
                        type="text"
                        value={datosFormulario.client}
                        onChange={(e) => establecerDatosFormulario({...datosFormulario, client: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Nombre de la empresa"
                        disabled={enviando}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Vendedor *</label>
                        <select
                          value={datosFormulario.vendor}
                          onChange={(e) => establecerDatosFormulario({...datosFormulario, vendor: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={enviando || (!infoVendedorActual?.is_admin && !!usuarioActual)}
                        >
                          {vendedores.map(vendedor => (
                            <option key={vendedor.name} value={vendedor.name}>
                              {vendedor.name} {vendedor.role && `(${vendedor.role})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Valor (R$) *</label>
                        <input
                          type="number"
                          value={datosFormulario.value}
                          onChange={(e) => establecerDatosFormulario({...datosFormulario, value: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="250000"
                          disabled={enviando}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Etapa *</label>
                        <select
                          value={datosFormulario.stage}
                          onChange={(e) => establecerDatosFormulario({...datosFormulario, stage: parseInt(e.target.value)})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={enviando}
                        >
                          {etapas.slice(0, 5).map(etapa => (
                            <option key={etapa.id} value={etapa.id}>
                              {etapa.name} ({etapa.probability}%)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Prioridad</label>
                        <select
                          value={datosFormulario.priority}
                          onChange={(e) => establecerDatosFormulario({...datosFormulario, priority: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={enviando}
                        >
                          <option value="baja">Baja</option>
                          <option value="media">Media</option>
                          <option value="alta">Alta</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Producto</label>
                        <input
                          type="text"
                          value={datosFormulario.product}
                          onChange={(e) => establecerDatosFormulario({...datosFormulario, product: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: Máquinas BP + Cinta"
                          disabled={enviando}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Industria</label>
                        <input
                          type="text"
                          value={datosFormulario.industry}
                          onChange={(e) => establecerDatosFormulario({...datosFormulario, industry: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: E-commerce, Farmacéutica"
                          disabled={enviando}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Cierre Previsto</label>
                        <input
                          type="date"
                          value={datosFormulario.expected_close}
                          onChange={(e) => establecerDatosFormulario({...datosFormulario, expected_close: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={enviando}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Próxima Acción</label>
                        <input
                          type="text"
                          value={datosFormulario.next_action}
                          onChange={(e) => establecerDatosFormulario({...datosFormulario, next_action: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: Demo técnica agendada para 15/02"
                          disabled={enviando}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <h3 className="text-lg font-semibold mb-4 text-green-800">👥 Contactos Principales</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Patrocinador Poder</label>
                      <input
                        type="text"
                        value={datosFormulario.power_sponsor}
                        onChange={(e) => establecerDatosFormulario({...datosFormulario, power_sponsor: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Quien firma el contrato"
                        disabled={enviando}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Patrocinador</label>
                      <input
                        type="text"
                        value={datosFormulario.sponsor}
                        onChange={(e) => establecerDatosFormulario({...datosFormulario, sponsor: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Decisor usuario"
                        disabled={enviando}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Principal Influenciador</label>
                      <input
                        type="text"
                        value={datosFormulario.influencer}
                        onChange={(e) => establecerDatosFormulario({...datosFormulario, influencer: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Influye en la decisión"
                        disabled={enviando}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Contacto de Apoyo</label>
                      <input
                        type="text"
                        value={datosFormulario.support_contact}
                        onChange={(e) => establecerDatosFormulario({...datosFormulario, support_contact: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Soporte interno"
                        disabled={enviando}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                  <h3 className="text-lg font-semibold mb-4 text-purple-800">📊 Escalas PPVVCC</h3>
                  <div className="space-y-4">
                    {escalas.map(escala => {
                      const Icono = escala.icon;
                      const datosEscala = datosFormulario.scales[escala.id as keyof Escalas];
                      const estaActiva = escalaActiva === escala.id;
                      const selectorAbierto = mostrarSelectorEscala === escala.id;

                      return (
                        <div key={escala.id} className={escala.bgColor + ' ' + escala.borderColor + ' border-2 rounded-lg p-4 transition-all ' + (estaActiva ? 'ring-2 ring-purple-400' : '')}>
                          <div 
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => establecerEscalaActiva(estaActiva ? null : escala.id)}
                          >
                            <div className="flex items-center">
                              <Icono className={'w-5 h-5 mr-3 ' + escala.color} />
                              <div>
                                <span className="font-bold text-sm">{escala.name}</span>
                                <p className="text-xs text-gray-600">{escala.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-2xl font-bold">{datosEscala.score}</span>
                              <ChevronRight className={'w-4 h-4 transition-transform ' + (estaActiva ? 'rotate-90' : '')} />
                            </div>
                          </div>

                          {estaActiva && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="space-y-3">
                                <div>
                                  <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium">Puntaje (0-10)</label>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        establecerMostrarSelectorEscala(selectorAbierto ? null : escala.id);
                                      }}
                                      className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 transition-colors flex items-center"
                                    >
                                      Ver opciones de escala
                                      {selectorAbierto ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                                    </button>
                                  </div>

                                  {selectorAbierto && (
                                    <div className="mb-4 bg-white rounded-lg p-3 max-h-60 overflow-y-auto border border-purple-200">
                                      {definicionesEscala[escala.id as keyof typeof definicionesEscala].map((def) => (
                                        <button
                                          key={def.level}
                                          type="button"
                                          onClick={() => seleccionarNivelEscala(escala.id, def.level, def.text)}
                                          className={'w-full text-left p-2 mb-1 rounded-lg transition-colors ' + 
                                            (datosEscala.score === def.level 
                                              ? 'bg-purple-100 border-2 border-purple-500' 
                                              : 'hover:bg-gray-50 border border-gray-200')}
                                        >
                                          <div className="flex items-start">
                                            <span className="font-bold text-purple-700 mr-2 min-w-[20px]">{def.level}</span>
                                            <span className="text-xs text-gray-700">{def.text}</span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={datosEscala.score}
                                    onChange={(e) => actualizarEscala(escala.id, 'score', parseInt(e.target.value))}
                                    className="w-full"
                                    disabled={enviando}
                                  />
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>0</span>
                                    <span className="font-bold">{datosEscala.score}</span>
                                    <span>10</span>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-2">Observaciones</label>
                                  <textarea
                                    value={datosEscala.description}
                                    onChange={(e) => actualizarEscala(escala.id, 'description', e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="Describa la situación actual..."
                                    disabled={enviando}
                                  />
                                </div>
                                <div className="bg-white p-3 rounded-lg">
                                  <p className="text-xs font-medium text-gray-700 mb-2">Preguntas clave:</p>
                                  <ul className="text-xs text-gray-600 space-y-1">
                                    {escala.questions?.map((pregunta, idx) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-purple-500 mr-2">•</span>
                                        {pregunta}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-8 pt-6 border-t">
              <button
                onClick={alCerrar}
                className="px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                onClick={manejarEnvio}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 flex items-center transition-colors font-medium disabled:opacity-50"
                disabled={enviando}
              >
                {enviando ? (
                  <React.Fragment>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <Save className="w-5 h-5 mr-2" />
                    {oportunidad ? 'Actualizar' : 'Crear'} Oportunidad
                  </React.Fragment>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Componente de Checklist para cambio de etapa
  const ModalChecklistEtapa = () => {
    if (!mostrarChecklistEtapa) return null;

    const etapaActual = etapas.find(s => s.id === mostrarChecklistEtapa.oportunidad.stage);
    const etapaObjetivo = etapas.find(s => s.id === mostrarChecklistEtapa.etapaObjetivo);
    
    const iniciarElementosVerificados = () => {
      const elementos: {[key: string]: boolean} = {};
      if (etapaActual?.checklist) {
        Object.values(etapaActual.checklist).forEach(key => {
          elementos[key] = false;
        });
      }
      return elementos;
    };
    
    const [elementosVerificados, establecerElementosVerificados] = useState<{[key: string]: boolean}>(iniciarElementosVerificados);

    if (!etapaActual || !etapaObjetivo) return null;

    const manejarCambioVerificacion = (key: string) => {
      establecerElementosVerificados(prev => ({...prev, [key]: !prev[key]}));
    };

    const todosVerificados = etapaActual.checklist && Object.values(etapaActual.checklist).every(key => elementosVerificados[key] === true);

    const confirmarCambioEtapa = async () => {
      if (!todosVerificados) {
        alert('Por favor, complete todos los ítems del checklist antes de avanzar.');
        return;
      }

      try {
        await moverEtapa(mostrarChecklistEtapa.oportunidad, mostrarChecklistEtapa.etapaObjetivo);
        establecerMostrarChecklistEtapa(null);
      } catch (error) {
        console.error('Error al mover etapa:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-2xl w-full">
          <div className="p-6 border-b">
            <h3 className="text-xl font-bold text-gray-900">
              ✅ Checklist para avanzar a {etapaObjetivo.name}
            </h3>
            <p className="text-gray-600 mt-1">
              Complete todos los ítems antes de mover la oportunidad
            </p>
          </div>

          <div className="p-6">
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">📋 {mostrarChecklistEtapa.oportunidad.name}</h4>
              <p className="text-sm text-blue-700">{mostrarChecklistEtapa.oportunidad.client}</p>
            </div>

            <div className="space-y-3">
              {etapaActual.checklist && Object.entries(etapaActual.checklist).map(([etiqueta, key]) => {
                const estaVerificado = elementosVerificados[key] === true;
                return (
                  <label key={key} className="flex items-start p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={estaVerificado}
                      onChange={() => manejarCambioVerificacion(key)}
                      className="mt-0.5 mr-3 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="text-gray-800 font-medium">{etiqueta}</span>
                      {estaVerificado && (
                        <CheckCircle className="inline-block w-5 h-5 text-green-600 ml-2" />
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                <AlertCircle className="inline-block w-4 h-4 mr-1" />
                <strong>Atención:</strong> Confirme que todos los requisitos fueron cumplidos antes de avanzar.
              </p>
            </div>
          </div>

          <div className="p-6 border-t flex justify-end space-x-4">
            <button
              onClick={() => establecerMostrarChecklistEtapa(null)}
              className="px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarCambioEtapa}
              className={'px-6 py-3 rounded-lg transition-colors flex items-center font-medium ' + 
                (todosVerificados 
                  ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white hover:from-blue-700 hover:to-green-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed')}
              disabled={!todosVerificados}
            >
              <Check className="w-5 h-5 mr-2" />
              Confirmar y Avanzar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-blue-50">
      <header className="bg-white shadow-lg border-b-2 border-blue-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl">
                <Factory className="w-8 h-8 text-white" />
              </div>
              <div className="ml-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  🇧🇷 CRM Ventapel Brasil
                </h1>
                <p className="text-sm text-gray-600">Metodología PPVVCC - Gestión Completa de Oportunidades</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={usuarioActual || ''}
                onChange={(e) => establecerUsuarioActual(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar vendedor...</option>
                {vendedores.map(vendedor => (
                  <option key={vendedor.name} value={vendedor.name}>
                    {vendedor.name} {vendedor.role && `(${vendedor.role})`}
                  </option>
                ))}
              </select>
              <div className="text-right">
                <p className="text-sm font-medium text-blue-600">🌐 ventapel.com.br</p>
                <div className="flex items-center text-xs text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  {usuarioActual ? `${usuarioActual} en línea` : 'En línea'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => establecerPestanaActiva('tablero')}
              className={'py-4 px-2 border-b-2 font-bold text-sm flex items-center ' + (pestanaActiva === 'tablero'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700')}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              📊 Tablero
            </button>
            <button
              onClick={() => establecerPestanaActiva('oportunidades')}
              className={'py-4 px-2 border-b-2 font-bold text-sm flex items-center ' + (pestanaActiva === 'oportunidades'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700')}
            >
              <Target className="w-4 h-4 mr-2" />
              🎯 {infoVendedorActual?.is_admin ? 'Todas las Oportunidades' : 'Mis Oportunidades'}
            </button>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {pestanaActiva === 'tablero' && <Tablero />}
        {pestanaActiva === 'oportunidades' && <ListaOportunidades />}
      </main>

      {mostrarNuevaOportunidad && (
        <FormularioOportunidad 
          alCerrar={() => establecerMostrarNuevaOportunidad(false)} 
        />
      )}

      {oportunidadEditando && (
        <FormularioOportunidad 
          oportunidad={oportunidadEditando}
          alCerrar={() => {
            establecerOportunidadEditando(null);
            establecerOportunidadSeleccionada(null);
          }} 
        />
      )}

      <ModalChecklistEtapa />
      
      <AIAssistant
        currentOpportunity={oportunidadSeleccionada || oportunidadEditando}
        onOpportunityUpdate={async (actualizada) => {
          if (oportunidadSeleccionada?.id === actualizada.id) {
            establecerOportunidadSeleccionada(actualizada);
          }
          if (oportunidadEditando?.id === actualizada.id) {
            establecerOportunidadEditando(actualizada);
          }
        }}
        currentUser={usuarioActual}
        supabase={supabase}
      />
    </div>
  );
};

// --- APP WRAPPER CON PROVEEDOR ---
const App: React.FC = () => {
  return (
    <ProveedorOportunidades>
      <CRMVentapel />
    </ProveedorOportunidades>
  );
};

export default App;
