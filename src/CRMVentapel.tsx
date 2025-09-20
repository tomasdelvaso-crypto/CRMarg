import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { Plus, Search, DollarSign, TrendingUp, User, Target, Eye, ShoppingCart, Edit3, Save, X, AlertCircle, BarChart3, Package, Factory, ChevronRight, Check, Trash2, CheckCircle, XCircle, ChevronDown, ChevronUp, Clock, Calendar, Users, Brain } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import AIAssistant from './AIAssistant';

// --- CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- TIPOS Y INTERFACES VARIAS---
interface Scale {
  score: number;
  description: string;
}

interface Scales {
  dor: Scale;
  poder: Scale;
  visao: Scale;
  valor: Scale;
  controle: Scale;
  compras: Scale;
}

interface Opportunity {
  id: number;
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
  scales: Scales;
  industry?: string;
}

interface OpportunityFormData {
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
  scales: Scales;
  industry?: string;
}

interface StageRequirement {
  id: number;
  name: string;
  probability: number;
  color: string;
  requirements: string[];
  checklist?: Record<string, string>;
}

interface VendorInfo {
  name: string;
  email?: string;
  role?: string;
  is_admin?: boolean;
}

// --- UTILIDADES ---
const emptyScales = (): Scales => ({
  dor: { score: 0, description: '' },
  poder: { score: 0, description: '' },
  visao: { score: 0, description: '' },
  valor: { score: 0, description: '' },
  controle: { score: 0, description: '' },
  compras: { score: 0, description: '' }
});

// Función helper para obtener el valor de una escala - CORREGIDA
const getScaleScore = (scale: Scale | number | undefined | null): number => {
  if (scale === null || scale === undefined) return 0;
  if (typeof scale === 'number') return scale;
  if (typeof scale === 'object' && 'score' in scale) {
    return typeof scale.score === 'number' ? scale.score : 0;
  }
  return 0;
};

// --- API SERVICE MEJORADO ---
class SupabaseService {
  async fetchOpportunities(): Promise<Opportunity[]> {
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .order('value', { ascending: false });

      if (error) throw error;

      // Normalizar datos - asegurar que scales siempre tenga el formato correcto
      return (data || []).map(opp => ({
        ...opp,
        scales: this.normalizeScales(opp.scales),
        value: Number(opp.value) || 0,
        probability: Number(opp.probability) || 0
      }));
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      throw error;
    }
  }

  async fetchVendors(): Promise<VendorInfo[]> {
    try {
      // Primero intentar tabla vendors
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true);

      if (vendorsData && vendorsData.length > 0) {
        return vendorsData;
      }

      // Si no hay tabla vendors, obtener únicos de opportunities
      const { data: oppsData, error: oppsError } = await supabase
        .from('opportunities')
        .select('vendor');

      if (oppsError) throw oppsError;

      const uniqueVendors = [...new Set(oppsData?.map(o => o.vendor).filter(Boolean) || [])];
      
      return uniqueVendors.map(name => ({
        name,
        role: this.getVendorRole(name),
        is_admin: name === 'Tomás'
      }));
    } catch (error) {
      console.error('Error fetching vendors:', error);
      // Fallback a lista por defecto
      return ['Tomás', 'Jordi', 'Matheus', 'Carlos', 'Paulo'].map(name => ({
        name,
        role: this.getVendorRole(name),
        is_admin: name === 'Tomás'
      }));
    }
  }

  private getVendorRole(name: string): string {
    const roles: Record<string, string> = {
      'Tomás': 'CEO/Jefe de Ventas',
      'Jordi': 'Gerente de Ventas',
      'Matheus': 'Ejecutivo de Cuentas'
    };
    return roles[name] || 'Vendedor';
  }

  private normalizeScales(scales: any): Scales {
    // Si scales es null, undefined o no es un objeto, retornar estructura vacía
    if (!scales || typeof scales !== 'object') {
      return emptyScales();
    }

    // Intentar normalizar desde diferentes formatos
    try {
      // Si ya tiene el formato correcto
      if (scales.dor && typeof scales.dor === 'object' && 'score' in scales.dor) {
        return scales;
      }

      // Si tiene formato antiguo con valores numéricos directos
      if (typeof scales.dor === 'number' || typeof scales.pain === 'number') {
        return {
          dor: { score: scales.dor || scales.pain || 0, description: '' },
          poder: { score: scales.poder || scales.power || 0, description: '' },
          visao: { score: scales.visao || scales.vision || 0, description: '' },
          valor: { score: scales.valor || scales.value || 0, description: '' },
          controle: { score: scales.controle || scales.control || 0, description: '' },
          compras: { score: scales.compras || scales.purchase || 0, description: '' }
        };
      }
    } catch (e) {
      console.error('Error normalizando scales:', e);
    }

    return emptyScales();
  }

  async insertOpportunity(data: Omit<Opportunity, 'id' | 'created_at'>): Promise<Opportunity> {
    try {
      const { data: result, error } = await supabase
        .from('opportunities')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error inserting opportunity:', error);
      throw error;
    }
  }

  async updateOpportunity(id: number, data: Partial<Opportunity>): Promise<Opportunity> {
    try {
      const { data: result, error } = await supabase
        .from('opportunities')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error updating opportunity:', error);
      throw error;
    }
  }

  async deleteOpportunity(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting opportunity:', error);
      throw error;
    }
  }
}

const supabaseService = new SupabaseService();

// --- COMPONENTE OpportunityHealthScore ---
const OpportunityHealthScore: React.FC<{ opportunity: Opportunity }> = ({ opportunity }) => {
  const calculateHealthScore = () => {
    if (!opportunity.scales) return 0;
    
    const scores = [
      getScaleScore(opportunity.scales.dor),
      getScaleScore(opportunity.scales.poder),
      getScaleScore(opportunity.scales.visao),
      getScaleScore(opportunity.scales.valor),
      getScaleScore(opportunity.scales.controle),
      getScaleScore(opportunity.scales.compras)
    ];
    
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(avg);
  };
  
  const score = calculateHealthScore();
  const getColor = () => {
    if (score >= 7) return 'text-green-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <span className={`font-bold ${getColor()}`}>
      ♥ {score}/10
    </span>
  );
};

// --- DEFINICIONES DE ETAPAS Y ESCALAS ---
const stages: StageRequirement[] = [
  { 
    id: 1, 
    name: 'Prospección', 
    probability: 0, 
    color: 'bg-gray-500',
    requirements: ['Identificar dolor del cliente', 'Contacto inicial establecido'],
    checklist: {
      'Identificó la empresa potencial': 'empresa_identificada',
      'Investigó sobre el negocio del cliente': 'pesquisa_negocio',
      'Identificó persona de contacto': 'contato_identificado',
      'Realizó primer contacto': 'primeiro_contato'
    }
  },
  { 
    id: 2, 
    name: 'Calificación', 
    probability: 20, 
    color: 'bg-blue-500',
    requirements: ['Score DOLOR ≥ 5', 'Score PODER ≥ 4', 'Budget confirmado'],
    checklist: {
      'Cliente admite tener problema/dolor (DOLOR ≥ 5)': 'dor_admitida',
      'Identificó tomador de decisión (PODER ≥ 4)': 'decisor_identificado',
      'Budget disponible confirmado': 'budget_confirmado',
      'Timeline del proyecto definida': 'timeline_definida',
      'Criterios de decisión entendidos': 'criterios_entendidos'
    }
  },
  { 
    id: 3, 
    name: 'Presentación', 
    probability: 40, 
    color: 'bg-yellow-500',
    requirements: ['Score VISIÓN ≥ 5', 'Presentación agendada', 'Stakeholders definidos'],
    checklist: {
      'Visión de solución creada (VISIÓN ≥ 5)': 'visao_criada',
      'Demo/Presentación realizada': 'demo_realizada',
      'Todos stakeholders presentes': 'stakeholders_presentes',
      'Objeciones principales identificadas': 'objecoes_identificadas',
      'Próximos pasos acordados': 'proximos_passos'
    }
  },
  { 
    id: 4, 
    name: 'Validación/Prueba', 
    probability: 75, 
    color: 'bg-orange-500',
    requirements: ['Score VALOR ≥ 6', 'Prueba/POC ejecutado', 'ROI validado'],
    checklist: {
      'POC/Prueba iniciado': 'poc_iniciado',
      'Criterios de éxito definidos': 'criterios_sucesso',
      'ROI calculado y validado (VALOR ≥ 6)': 'roi_validado',
      'Resultados documentados': 'resultados_documentados',
      'Aprobación técnica obtenida': 'aprovacao_tecnica'
    }
  },
  { 
    id: 5, 
    name: 'Negociación', 
    probability: 90, 
    color: 'bg-green-500',
    requirements: ['Score CONTROL ≥ 7', 'Score COMPRAS ≥ 6', 'Propuesta enviada'],
    checklist: {
      'Propuesta comercial enviada': 'proposta_enviada',
      'Términos negociados (COMPRAS ≥ 6)': 'termos_negociados',
      'Control del proceso (CONTROL ≥ 7)': 'controle_processo',
      'Aprobación verbal recibida': 'aprovacao_verbal',
      'Contrato en revisión legal': 'revisao_legal'
    }
  },
  { 
    id: 6, 
    name: 'Cerrado', 
    probability: 100, 
    color: 'bg-emerald-600',
    requirements: ['Contrato firmado', 'Pago procesado'],
    checklist: {
      'Contrato firmado': 'contrato_assinado',
      'Pedido de compra emitido': 'pedido_compra',
      'Kickoff agendado': 'kickoff_agendado',
      'Pago procesado': 'pagamento_processado'
    }
  }
];

const scales = [
  { 
    id: 'dor', 
    name: 'DOLOR', 
    icon: AlertCircle, 
    description: 'Dolor identificado y admitido', 
    color: 'text-red-600', 
    bgColor: 'bg-red-50', 
    borderColor: 'border-red-200',
    questions: [
      '¿Cliente admite tener el problema?',
      '¿El problema está costando dinero?', 
      '¿Las consecuencias son mensurables?',
      '¿Urgencia para resolver?'
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
      '¿Decisor participa de las reuniones?',
      '¿Proceso de decisión mapeado?'
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
      '¿Cliente ve valor en la solución?',
      '¿Los beneficios están claros?',
      '¿La solución resuelve el dolor?',
      '¿Cliente puede visualizar implementación?'
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
      '¿ROI fue calculado?',
      '¿Cliente concuerda con ROI?',
      '¿Valor justifica inversión?',
      '¿Los beneficios son mensurables?'
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
      '¿Próximos pasos definidos?',
      '¿Timeline acordada?',
      '¿Competidores identificados?'
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
      '¿Proceso de compras mapeado?',
      '¿Budget aprobado?',
      '¿Procurement involucrado?',
      '¿Documentación necesaria conocida?'
    ]
  }
];

const scaleDefinitions = {
  dor: [
    { level: 0, text: "No hay identificación de necesidad o dolor por el cliente" },
    { level: 1, text: "Vendedor asume necesidades del cliente" },
    { level: 2, text: "Persona de Contacto admite necesidad" },
    { level: 3, text: "Persona de Contacto admite razones y síntomas causadores de dolor" },
    { level: 4, text: "Persona de Contacto admite dolor" },
    { level: 5, text: "Vendedor documenta dolor y Persona de Contacto concuerda" },
    { level: 6, text: "Persona de Contacto formaliza necesidades del Tomador de Decisión" },
    { level: 7, text: "Tomador de Decisión admite necesidades" },
    { level: 8, text: "Tomador de Decisión admite razones y síntomas causadores de dolor" },
    { level: 9, text: "Tomador de Decisión admite dolor" },
    { level: 10, text: "Vendedor documenta dolor y Power concuerda" }
  ],
  poder: [
    { level: 0, text: "Tomador de Decisión no fue identificado aún" },
    { level: 1, text: "Proceso de decisión revelado por Persona de Contacto" },
    { level: 2, text: "Tomador de Decisión Potencial identificado" },
    { level: 3, text: "Pedido de acceso a Tomador de Decisión concedido por Persona de Contacto" },
    { level: 4, text: "Tomador de Decisión accedido" },
    { level: 5, text: "Tomador de Decisión concuerda en explorar oportunidad" },
    { level: 6, text: "Proceso de decisión y compra confirmado por el Tomador de Decisión" },
    { level: 7, text: "Tomador de Decisión concuerda en hacer una Prueba de Valor" },
    { level: 8, text: "Tomador de Decisión concuerda con contenido de la propuesta" },
    { level: 9, text: "Tomador de Decisión confirma aprobación verbal" },
    { level: 10, text: "Tomador de Decisión aprueba formalmente internamente" }
  ],
  visao: [
    { level: 0, text: "Ninguna visión o visión competidora establecida" },
    { level: 1, text: "Visión de Persona de Contacto creada en términos de producto" },
    { level: 2, text: "Visión Persona de Contacto creada en términos: Situación/Problema/Implicación" },
    { level: 3, text: "Visión diferenciada creada con Persona de Contacto (SPI)" },
    { level: 4, text: "Visión diferenciada documentada con Persona de Contacto" },
    { level: 5, text: "Documentación acordada por Persona de Contacto" },
    { level: 6, text: "Visión Power creada en términos de producto" },
    { level: 7, text: "Visión Power creada en términos: Situación/Problema/Implicación" },
    { level: 8, text: "Visión diferenciada creada con Tomador de Decisión (SPIN)" },
    { level: 9, text: "Visión diferenciada documentada con Tomador de Decisión" },
    { level: 10, text: "Documentación acordada por Tomador de Decisión" }
  ],
  valor: [
    { level: 0, text: "Persona de Contacto explora la solución, pero valor no fue identificado" },
    { level: 1, text: "Vendedor identifica proposición de valor para el negocio" },
    { level: 2, text: "Persona de Contacto concuerda en explorar la propuesta de valor" },
    { level: 3, text: "Tomador de Decisión concuerda en explorar la propuesta de valor" },
    { level: 4, text: "Criterios para definición de valor establecidos con Tomador de Decisión" },
    { level: 5, text: "Valor descubierto conducido y visión Tomador de Decisión" },
    { level: 6, text: "Análisis de valor conducida por vendedor (demo)" },
    { level: 7, text: "Análisis de valor conducida por Persona de Contacto (trial)" },
    { level: 8, text: "Tomador de Decisión concuerda con análisis de Valor" },
    { level: 9, text: "Conclusión del análisis de valor documentada por el vendedor" },
    { level: 10, text: "Tomador de Decisión confirma por escrito conclusiones del análisis" }
  ],
  controle: [
    { level: 0, text: "Ningún seguimiento documentado de conversación con Persona de Contacto" },
    { level: 1, text: "1ª visión (SPI) enviada para Persona de Contacto" },
    { level: 2, text: "1ª visión acordada o modificada por Persona de Contacto (SPIN)" },
    { level: 3, text: "1ª visión enviada para Tomador de Decisión (SPI)" },
    { level: 4, text: "1ª visión acordada o modificada por Tomador de Decisión (SPIN)" },
    { level: 5, text: "Vendedor recibe aprobación para explorar Valor" },
    { level: 6, text: "Plan de evaluación enviado para Tomador de Decisión" },
    { level: 7, text: "Tomador de Decisión concuerda o modifica la Evaluación" },
    { level: 8, text: "Plan de Evaluación conducido (cuando aplicable)" },
    { level: 9, text: "Resultado de la Evaluación aprobado por el Tomador de Decisión" },
    { level: 10, text: "Tomador de Decisión aprueba propuesta para negociación final" }
  ],
  compras: [
    { level: 0, text: "Proceso de compras desconocido" },
    { level: 1, text: "Proceso de compras aclarado por la persona de contacto" },
    { level: 2, text: "Proceso de compras confirmado por el Tomador de Decisión" },
    { level: 3, text: "Condiciones comerciales validadas con el cliente" },
    { level: 4, text: "Propuesta presentada para el cliente" },
    { level: 5, text: "Proceso de negociación iniciado con departamento de compras" },
    { level: 6, text: "Condiciones comerciales aprobadas y formalizadas" },
    { level: 7, text: "Contrato firmado" },
    { level: 8, text: "Pedido de compras recibido" },
    { level: 9, text: "Cobranza emitida" },
    { level: 10, text: "Pago realizado" }
  ]
};

// --- CONTEXT API ---
interface OpportunitiesContextType {
  opportunities: Opportunity[];
  loading: boolean;
  error: string | null;
  vendors: VendorInfo[];
  currentUser: string | null;
  setCurrentUser: (user: string | null) => void;
  setError: (error: string | null) => void;
  loadOpportunities: () => Promise<void>;
  loadVendors: () => Promise<void>;
  createOpportunity: (data: OpportunityFormData) => Promise<boolean>;
  updateOpportunity: (id: number, data: OpportunityFormData) => Promise<boolean>;
  deleteOpportunity: (id: number) => Promise<void>;
  moveStage: (opportunity: Opportunity, newStage: number) => Promise<void>;
}

const OpportunitiesContext = createContext<OpportunitiesContextType | null>(null);

const useOpportunitiesContext = () => {
  const context = useContext(OpportunitiesContext);
  if (!context) {
    throw new Error('useOpportunitiesContext must be used within OpportunitiesProvider');
  }
  return context;
};

// --- PROVIDER COMPONENT ---
const OpportunitiesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [vendors, setVendors] = useState<VendorInfo[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVendors = useCallback(async () => {
    try {
      const vendorData = await supabaseService.fetchVendors();
      setVendors(vendorData);
      
      if (!currentUser) {
        const savedUser = localStorage.getItem('ventapel_user');
        if (savedUser && vendorData.some(v => v.name === savedUser)) {
          setCurrentUser(savedUser);
        } else if (vendorData.length > 0) {
          setCurrentUser(vendorData[0].name);
        }
      }
    } catch (err) {
      console.error('Error al cargar vendedores:', err);
      setError('Error al cargar vendedores');
    }
  }, [currentUser]);

  const loadOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseService.fetchOpportunities();
      setOpportunities(data);
    } catch (err) {
      console.error('Error al cargar oportunidades:', err);
      setError('Error al cargar oportunidades. Por favor, inténtelo de nuevo.');
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createOpportunity = useCallback(async (formData: OpportunityFormData): Promise<boolean> => {
    try {
      setError(null);
      
      // Validación básica
      if (!formData.name?.trim() || !formData.client?.trim() || !formData.value) {
        setError('Por favor, complete los campos obligatorios: Nombre, Cliente y Valor');
        return false;
      }
      
      // CRÍTICO: Asegurar que scales NUNCA sea null o undefined
      let safeScales = formData.scales;
      if (!safeScales || typeof safeScales !== 'object') {
        console.warn('⚠️ Scales inválidas, usando valores por defecto');
        safeScales = emptyScales();
      }
      
      // Construir el objeto para insertar
      const newOpportunity = {
        name: formData.name.trim(),
        client: formData.client.trim(),
        vendor: formData.vendor || currentUser || 'Tomás',
        value: parseFloat(formData.value.toString()) || 0,
        stage: parseInt(formData.stage?.toString() || '1'),
        priority: formData.priority || 'media',
        probability: stages.find(s => s.id === (parseInt(formData.stage?.toString() || '1')))?.probability || 0,
        last_update: new Date().toISOString().split('T')[0],
        scales: safeScales, // Usar las scales seguras
        // Campos opcionales - usar null si están vacíos
        expected_close: formData.expected_close || null,
        next_action: formData.next_action?.trim() || null,
        product: formData.product?.trim() || null,
        power_sponsor: formData.power_sponsor?.trim() || null,
        sponsor: formData.sponsor?.trim() || null,
        influencer: formData.influencer?.trim() || null,
        support_contact: formData.support_contact?.trim() || null,
        industry: formData.industry?.trim() || null
      };

      console.log('📝 Intentando crear oportunidad:', newOpportunity);
      await supabaseService.insertOpportunity(newOpportunity);
      await loadOpportunities();
      return true;
      
    } catch (err) {
      console.error('❌ Error al crear oportunidad:', err);
      setError(`Error al crear oportunidad: ${err.message || 'Verifique los datos'}`);
      return false;
    }
  }, [loadOpportunities, currentUser]);

  const updateOpportunity = useCallback(async (id: number, formData: OpportunityFormData): Promise<boolean> => {
    try {
      setError(null);
      
      // CRÍTICO: Asegurar que scales NUNCA sea null
      let safeScales = formData.scales;
      if (!safeScales || typeof safeScales !== 'object') {
        console.warn('⚠️ Scales inválidas en update, usando valores por defecto');
        safeScales = emptyScales();
      }
      
      const updatedData = {
        name: formData.name.trim(),
        client: formData.client.trim(),
        vendor: formData.vendor || currentUser || 'Tomás',
        value: parseFloat(formData.value.toString()) || 0,
        stage: parseInt(formData.stage?.toString() || '1'),
        priority: formData.priority || 'media',
        probability: stages.find(s => s.id === (parseInt(formData.stage?.toString() || '1')))?.probability || 0,
        last_update: new Date().toISOString().split('T')[0],
        scales: safeScales, // Usar scales seguras
        expected_close: formData.expected_close || null,
        next_action: formData.next_action?.trim() || null,
        product: formData.product?.trim() || null,
        power_sponsor: formData.power_sponsor?.trim() || null,
        sponsor: formData.sponsor?.trim() || null,
        influencer: formData.influencer?.trim() || null,
        support_contact: formData.support_contact?.trim() || null,
        industry: formData.industry?.trim() || null
      };

      console.log('📝 Actualizando oportunidad:', updatedData);
      await supabaseService.updateOpportunity(id, updatedData);
      await loadOpportunities();
      return true;
      
    } catch (err) {
      console.error('❌ Error al actualizar oportunidad:', err);
      setError(`Error al actualizar: ${err.message || 'Verifique los datos'}`);
      return false;
    }
  }, [loadOpportunities, currentUser]);

  const deleteOpportunity = useCallback(async (id: number): Promise<void> => {
    if (!confirm('¿Está seguro de que desea eliminar esta oportunidad?')) {
      return;
    }

    try {
      setError(null);
      await supabaseService.deleteOpportunity(id);
      setOpportunities(prev => prev.filter(opp => opp.id !== id));
    } catch (err) {
      console.error('Error al eliminar oportunidad:', err);
      setError('Error al eliminar oportunidad. Por favor, inténtelo de nuevo.');
      await loadOpportunities();
    }
  }, [loadOpportunities]);

  const moveStage = useCallback(async (opportunity: Opportunity, newStage: number): Promise<void> => {
    const stage = stages.find(s => s.id === newStage);
    if (!stage) {
      console.error('Etapa no encontrada:', newStage);
      return;
    }

    try {
      setError(null);
      
      const updatedData = {
        stage: newStage,
        probability: stage.probability,
        last_update: new Date().toISOString().split('T')[0]
      };

      await supabaseService.updateOpportunity(opportunity.id, updatedData);
      
      setOpportunities(prev => prev.map(opp => 
        opp.id === opportunity.id 
          ? { ...opp, ...updatedData }
          : opp
      ));
    } catch (err) {
      console.error('Error al mover etapa:', err);
      setError('Error al actualizar etapa. Por favor, inténtelo de nuevo.');
      await loadOpportunities();
    }
  }, [loadOpportunities]);

  useEffect(() => {
    loadVendors();
    loadOpportunities();

    // Suscribirse a cambios en tiempo real
    const subscription = supabase
      .channel('opportunities-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'opportunities' },
        (payload) => {
          console.log('Cambio detectado:', payload);
          loadOpportunities();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('ventapel_user', currentUser);
    }
  }, [currentUser]);

  const value = useMemo(() => ({
    opportunities,
    loading,
    error,
    vendors,
    currentUser,
    setCurrentUser,
    setError,
    loadOpportunities,
    loadVendors,
    createOpportunity,
    updateOpportunity,
    deleteOpportunity,
    moveStage
  }), [opportunities, loading, error, vendors, currentUser, loadOpportunities, loadVendors, createOpportunity, updateOpportunity, deleteOpportunity, moveStage]);

  return (
    <OpportunitiesContext.Provider value={value}>
      {children}
    </OpportunitiesContext.Provider>
  );
};

// --- HOOKS UTILITARIOS ---
const useFilters = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterInactivity, setFilterInactivity] = useState('all');

  return {
    searchTerm,
    setSearchTerm,
    filterStage,
    setFilterStage,
    filterVendor,
    setFilterVendor,
    filterInactivity,
    setFilterInactivity
  };
};

// --- COMPONENTES ---
const ErrorAlert: React.FC<{ error: string; onClose: () => void }> = ({ error, onClose }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-center">
      <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
      <span className="text-red-800">{error}</span>
      <button onClick={onClose} className="ml-auto text-red-600 hover:text-red-800">
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const LoadingSpinner: React.FC = () => (
  <div className="text-center py-12 bg-white rounded-xl border">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
    <p className="mt-4 text-gray-600">Cargando oportunidades...</p>
  </div>
);

// --- FUNCIONES AUXILIARES CORREGIDAS ---
const checkStageRequirements = (opportunity: Opportunity, stageId: number): boolean => {
  // Si no hay scales, no cumple requisitos
  if (!opportunity.scales) return false;

  // Asegurar que scales es un objeto válido
  const scales = opportunity.scales || emptyScales();

  switch (stageId) {
    case 2:
      return getScaleScore(scales.dor) >= 5 && 
             getScaleScore(scales.poder) >= 4;
    case 3:
      return getScaleScore(scales.visao) >= 5;
    case 4:
      return getScaleScore(scales.valor) >= 6;
    case 5:
      return getScaleScore(scales.controle) >= 7 && 
             getScaleScore(scales.compras) >= 6;
    default:
      return true;
  }
};

const checkInactivity = (lastUpdate: string, days: number): boolean => {
  const lastUpdateDate = new Date(lastUpdate);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - lastUpdateDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= days;
};

// --- COMPONENTE PRINCIPAL ---
const CRMVentapel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNewOpportunity, setShowNewOpportunity] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [dashboardVendorFilter, setDashboardVendorFilter] = useState('all');
  const [selectedStageForList, setSelectedStageForList] = useState<number | null>(null);
  const [showStageChecklist, setShowStageChecklist] = useState<{ opportunity: Opportunity, targetStage: number } | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false); // MODIFICACIÓN 2: Nuevo estado

  const { 
    opportunities, 
    loading, 
    error, 
    vendors,
    currentUser,
    setCurrentUser,
    setError, 
    createOpportunity, 
    updateOpportunity, 
    deleteOpportunity, 
    moveStage 
  } = useOpportunitiesContext();
  
  const filters = useFilters();

  // Obtener información del vendor actual
  const currentVendorInfo = useMemo(() => {
    return vendors.find(v => v.name === currentUser) || null;
  }, [vendors, currentUser]);

  // Filtrar oportunidades según el usuario actual
  const userOpportunities = useMemo(() => {
    if (!currentUser) return opportunities;
    if (currentVendorInfo?.is_admin) return opportunities;
    return opportunities.filter(opp => opp.vendor === currentUser);
  }, [opportunities, currentUser, currentVendorInfo]);

  const filteredOpportunities = useMemo(() => {
    return userOpportunities.filter(opp => {
      const matchesSearch = opp.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                           opp.client.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                           (opp.product && opp.product.toLowerCase().includes(filters.searchTerm.toLowerCase()));
      const matchesStage = filters.filterStage === 'all' || opp.stage.toString() === filters.filterStage;
      const matchesVendor = filters.filterVendor === 'all' || opp.vendor === filters.filterVendor;
      
      let matchesInactivity = true;
      if (filters.filterInactivity === '7days') {
        matchesInactivity = checkInactivity(opp.last_update, 7);
      } else if (filters.filterInactivity === '30days') {
        matchesInactivity = checkInactivity(opp.last_update, 30);
      }
      
      return matchesSearch && matchesStage && matchesVendor && matchesInactivity;
    });
  }, [userOpportunities, filters.searchTerm, filters.filterStage, filters.filterVendor, filters.filterInactivity]);

  const dashboardOpportunities = useMemo(() => {
    const baseOpps = currentVendorInfo?.is_admin ? opportunities : userOpportunities;
    if (dashboardVendorFilter === 'all') return baseOpps;
    return baseOpps.filter(opp => opp.vendor === dashboardVendorFilter);
  }, [opportunities, userOpportunities, dashboardVendorFilter, currentVendorInfo]);

  const metrics = useMemo(() => ({
    totalValue: dashboardOpportunities.reduce((sum, opp) => sum + (opp.value || 0), 0),
    weightedValue: dashboardOpportunities.reduce((sum, opp) => sum + ((opp.value || 0) * (opp.probability || 0) / 100), 0),
    totalOpportunities: dashboardOpportunities.length,
    avgScore: dashboardOpportunities.length > 0 ? 
      dashboardOpportunities.reduce((sum, opp) => {
        if (!opp.scales) return sum;
        const scaleScores = [
          getScaleScore(opp.scales.dor),
          getScaleScore(opp.scales.poder),
          getScaleScore(opp.scales.visao),
          getScaleScore(opp.scales.valor),
          getScaleScore(opp.scales.controle),
          getScaleScore(opp.scales.compras)
        ];
        const avgOppScore = scaleScores.reduce((a, b) => a + b, 0) / scaleScores.length;
        return sum + avgOppScore;
      }, 0) / dashboardOpportunities.length : 0,
    avgProbability: dashboardOpportunities.length > 0 ?
      dashboardOpportunities.reduce((sum, opp) => sum + (opp.probability || 0), 0) / dashboardOpportunities.length : 0,
    stageDistribution: stages.map(stage => ({
      ...stage,
      count: dashboardOpportunities.filter(opp => opp.stage === stage.id).length,
      value: dashboardOpportunities.filter(opp => opp.stage === stage.id).reduce((sum, opp) => sum + (opp.value || 0), 0),
      weightedValue: dashboardOpportunities.filter(opp => opp.stage === stage.id).reduce((sum, opp) => sum + ((opp.value || 0) * (opp.probability || 0) / 100), 0),
      opportunities: dashboardOpportunities.filter(opp => opp.stage === stage.id)
    }))
  }), [dashboardOpportunities]);

  // MODIFICACIÓN 3: Función para abrir el asistente con contexto
  const openAssistantWithOpportunity = useCallback((opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setIsAssistantOpen(true);
    // Disparar evento para que el AIAssistant se abra
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openAssistant'));
    }, 100);
  }, []);

  const handleMoveStage = useCallback(async (opportunity: Opportunity, newStage: number) => {
    if (newStage > opportunity.stage && !checkStageRequirements(opportunity, opportunity.stage)) {
      setShowStageChecklist({ opportunity, targetStage: newStage });
      return;
    }
    
    await moveStage(opportunity, newStage);
  }, [moveStage]);

  // --- COMPONENTES INTERNOS ---
  const Dashboard = () => (
    <div className="space-y-8">
      {error && <ErrorAlert error={error} onClose={() => setError(null)} />}

      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">🎯 CRM Ventapel Brasil</h2>
            <p className="text-blue-100">Sistema de Ventas Consultivas - Metodología PPVVCC</p>
            <p className="text-blue-100 text-sm">🔗 Conectado a Supabase</p>
            {currentUser && (
              <p className="text-yellow-300 text-sm mt-1">
                👤 {currentUser} {currentVendorInfo?.role && `(${currentVendorInfo.role})`}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">R$ {metrics.totalValue.toLocaleString('es-AR')}</div>
            <div className="text-blue-100">Pipeline Total</div>
            <div className="text-lg font-semibold text-yellow-300 mt-1">
              R$ {metrics.weightedValue.toLocaleString('es-AR')} ponderado
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
                R$ {metrics.totalValue.toLocaleString('es-AR')}
              </p>
              <p className="text-sm text-green-600">
                Ponderado: R$ {metrics.weightedValue.toLocaleString('es-AR')}
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
              <p className="text-2xl font-bold text-blue-800">{metrics.totalOpportunities}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl shadow-sm border border-purple-200">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-purple-700">Score PPVVCC</p>
              <p className="text-2xl font-bold text-purple-800">{metrics.avgScore.toFixed(1)}/10</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-xl shadow-sm border border-orange-200">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-orange-700">Prob. Media</p>
              <p className="text-2xl font-bold text-orange-800">{metrics.avgProbability.toFixed(0)}%</p>
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
              value={dashboardVendorFilter}
              onChange={(e) => setDashboardVendorFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!currentVendorInfo?.is_admin && Boolean(currentUser)}
            >
              <option value="all">👥 Todos vendedores</option>
              {vendors.map(vendor => (
                <option key={vendor.name} value={vendor.name}>
                  {vendor.name} {vendor.role && `(${vendor.role})`}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="space-y-4">
          {metrics.stageDistribution.slice(0, 5).map(stage => (
            <div key={stage.id}>
              <div 
                className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                onClick={() => setSelectedStageForList(selectedStageForList === stage.id ? null : stage.id)}
              >
                <div className="w-32 text-sm font-medium text-gray-700">{stage.name}</div>
                <div className="flex-1 mx-6">
                  <div className="bg-gray-200 rounded-full h-8 relative">
                    <div 
                      className={stage.color + ' h-8 rounded-full transition-all duration-500'}
                      style={{ width: Math.max((stage.count / Math.max(...metrics.stageDistribution.map(s => s.count), 1)) * 100, 5) + '%' }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white">
                      {stage.count > 0 && stage.count + ' oportunidades'}
                    </div>
                  </div>
                </div>
                <div className="w-20 text-sm text-gray-600 text-center">{stage.count}</div>
                <div className="w-40 text-sm font-medium text-right text-gray-800">
                  R$ {stage.value.toLocaleString('es-AR')}
                </div>
                <div className="w-40 text-sm text-right text-gray-600">
                  Pond: R$ {stage.weightedValue.toLocaleString('es-AR')}
                </div>
                <ChevronDown className={'w-5 h-5 ml-4 text-gray-400 transition-transform ' + (selectedStageForList === stage.id ? 'rotate-180' : '')} />
              </div>
              
              {selectedStageForList === stage.id && stage.opportunities.length > 0 && (
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
                      {stage.opportunities.map(opp => (
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
                            {/* MODIFICACIÓN 6: Agregar botón Brain en la tabla */}
                            <div className="flex space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOpportunity(opp);
                                  setEditingOpportunity(opp);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAssistantWithOpportunity(opp);
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
                R$ {metrics.totalValue.toLocaleString('es-AR')}
              </div>
              <div className="text-sm text-gray-600">
                Ponderado: R$ {metrics.weightedValue.toLocaleString('es-AR')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

const OpportunityCard: React.FC<{ opportunity: Opportunity }> = ({ opportunity }) => {
    const stage = stages.find(s => s.id === opportunity.stage);
    const nextStage = stages.find(s => s.id === opportunity.stage + 1);
    const prevStage = stages.find(s => s.id === opportunity.stage - 1);
    
    const avgScore = opportunity.scales ? 
      [
        getScaleScore(opportunity.scales.dor),
        getScaleScore(opportunity.scales.poder),
        getScaleScore(opportunity.scales.visao),
        getScaleScore(opportunity.scales.valor),
        getScaleScore(opportunity.scales.controle),
        getScaleScore(opportunity.scales.compras)
      ].reduce((a, b) => a + b, 0) / 6 : 0;

    const canAdvance = nextStage && checkStageRequirements(opportunity, opportunity.stage);
    const isInactive7Days = checkInactivity(opportunity.last_update, 7);
    const isInactive30Days = checkInactivity(opportunity.last_update, 30);

    return (
      <div className={'bg-white rounded-xl shadow-sm border p-6 hover:shadow-lg transition-all ' + 
        (isInactive30Days ? 'border-red-300 bg-red-50' : isInactive7Days ? 'border-yellow-300 bg-yellow-50' : '')}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-xl font-bold text-gray-900">{opportunity.name}</h3>
              <OpportunityHealthScore opportunity={opportunity} />
              {isInactive30Days && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  +30 días sin movimiento
                </span>
              )} 
              {!isInactive30Days && isInactive7Days && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  +7 días sin movimiento
                </span>
              )}
              {/* MODIFICACIÓN 4: Agregar botón Brain en OpportunityCard */}
              <button
                onClick={() => {
                  setEditingOpportunity(opportunity);
                  setSelectedOpportunity(opportunity);
                }}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Editar oportunidad"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => openAssistantWithOpportunity(opportunity)}
                className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                title="Analizar con Coach IA"
              >
                <Brain className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteOpportunity(opportunity.id)}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar oportunidad"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-blue-600">{opportunity.client}</p>
              <p className="text-sm text-gray-600">👤 {opportunity.vendor}</p>
              <p className="text-sm text-purple-600">📦 {opportunity.product}</p>
              {opportunity.industry && (
                <p className="text-sm text-gray-600">🏭 {opportunity.industry}</p>
              )}
              {opportunity.expected_close && (
                <p className="text-sm text-gray-600">📅 Cierre: {new Date(opportunity.expected_close).toLocaleDateString('es-AR')}</p>
              )}
            </div>
            {opportunity.next_action && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">📅 <strong>Próxima acción:</strong> {opportunity.next_action}</p>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              Última actualización: {new Date(opportunity.last_update).toLocaleDateString('es-AR')}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600 mb-2">
              R$ {(opportunity.value || 0).toLocaleString('es-AR')}
            </p>
            <span className={'inline-block px-4 py-2 rounded-full text-sm font-bold text-white ' + (stage?.color || '') + ' mb-2'}>
              {stage?.name} ({opportunity.probability || 0}%)
            </span>
            <p className="text-sm text-gray-600 font-medium">
              Ponderado: R$ {((opportunity.value || 0) * (opportunity.probability || 0) / 100).toLocaleString('es-AR')}
            </p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-700">🎯 Gestión de Etapa</h4>
            <div className="flex space-x-2">
              {prevStage && (
                <button
                  onClick={() => handleMoveStage(opportunity, prevStage.id)}
                  className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  ← {prevStage.name}
                </button>
              )}
              {nextStage && (
                <button
                  onClick={() => handleMoveStage(opportunity, nextStage.id)}
                  className={'px-3 py-1 text-xs rounded-md transition-colors flex items-center ' + (canAdvance 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-red-100 text-red-600 cursor-not-allowed')}
                >
                  {nextStage.name} →
                  {canAdvance ? <Check className="w-3 h-3 ml-1" /> : <X className="w-3 h-3 ml-1" />}
                </button>
              )}
            </div>
          </div>
          
          {nextStage && (
            <div className="text-xs text-gray-600">
              <p className="font-medium mb-1">Requisitos para {nextStage.name}:</p>
              <ul className="space-y-1">
                {nextStage.requirements?.map((req, idx) => (
                  <li key={idx} className="flex items-center">
                    <div className={'w-2 h-2 rounded-full mr-2 ' + (checkStageRequirements(opportunity, opportunity.stage) ? 'bg-green-500' : 'bg-red-500')}></div>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* MODIFICACIÓN 5: Agregar indicador visual cuando hay oportunidad seleccionada */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-gray-700">📊 Score PPVVCC General</span>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-gray-900">{avgScore.toFixed(1)}/10</span>
              {selectedOpportunity?.id === opportunity.id && (
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
              style={{ width: (avgScore / 10) * 100 + '%' }}
            ></div>
          </div>
          
          {opportunity.scales && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {scales.map(scale => {
                const Icon = scale.icon;
                const scaleData = opportunity.scales[scale.id as keyof Scales];
                const scoreValue = getScaleScore(scaleData);
                return (
                  <div key={scale.id} className={scale.bgColor + ' ' + scale.borderColor + ' border-2 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all'}
                       onClick={() => {
                         setEditingOpportunity(opportunity);
                         setSelectedOpportunity(opportunity);
                       }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <Icon className={'w-4 h-4 mr-2 ' + scale.color} />
                        <span className="text-xs font-bold">{scale.name}</span>
                      </div>
                      <span className="text-lg font-bold text-gray-800">{scoreValue}</span>
                    </div>
                    {scaleData.description && (
                      <p className="text-xs text-gray-600 mt-1">{scaleData.description}</p>
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
            {opportunity.power_sponsor && (
              <div className="flex items-center">
                <span className="font-medium text-gray-600 mr-2">Power Sponsor:</span>
                <span className="text-gray-800">{opportunity.power_sponsor}</span>
              </div>
            )}
            {opportunity.sponsor && (
              <div className="flex items-center">
                <span className="font-medium text-gray-600 mr-2">Sponsor:</span>
                <span className="text-gray-800">{opportunity.sponsor}</span>
              </div>
            )}
            {opportunity.influencer && (
              <div className="flex items-center">
                <span className="font-medium text-gray-600 mr-2">Influenciador:</span>
                <span className="text-gray-800">{opportunity.influencer}</span>
              </div>
            )}
            {opportunity.support_contact && (
              <div className="flex items-center">
                <span className="font-medium text-gray-600 mr-2">Contacto Apoyo:</span>
                <span className="text-gray-800">{opportunity.support_contact}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const OpportunityList = () => (
    <div className="space-y-6">
      {error && <ErrorAlert error={error} onClose={() => setError(null)} />}

      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">🔍 Filtros y Búsqueda</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por cliente, oportunidad o producto..."
                value={filters.searchTerm}
                onChange={(e) => filters.setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <select
              value={filters.filterStage}
              onChange={(e) => filters.setFilterStage(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">📊 Todas las etapas</option>
              {stages.slice(0, 5).map(stage => (
                <option key={stage.id} value={stage.id.toString()}>
                  {stage.name} ({stage.probability}%)
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filters.filterVendor}
              onChange={(e) => filters.setFilterVendor(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!currentVendorInfo?.is_admin}
            >
              <option value="all">👥 Todos vendedores</option>
              {vendors.map(vendor => (
                <option key={vendor.name} value={vendor.name}>
                  {vendor.name} {vendor.role && `(${vendor.role})`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filters.filterInactivity}
              onChange={(e) => filters.setFilterInactivity(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">⏰ Todas actividades</option>
              <option value="7days">🟡 +7 días sin movimiento</option>
              <option value="30days">🔴 +30 días sin movimiento</option>
            </select>
          </div>
          <div>
            <button
              onClick={() => setShowNewOpportunity(true)}
              className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 font-bold transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nueva Oportunidad
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid gap-6">
          {filteredOpportunities.map(opportunity => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
          {filteredOpportunities.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border">
              <Factory className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ninguna oportunidad encontrada</h3>
              <p className="text-gray-600 mb-6">Ajuste los filtros o agregue una nueva oportunidad Ventapel</p>
              <button
                onClick={() => setShowNewOpportunity(true)}
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

  interface OpportunityFormProps {
    opportunity?: Opportunity | null;
    onClose: () => void;
  }

  const OpportunityForm: React.FC<OpportunityFormProps> = ({ opportunity, onClose }) => {
    // IMPORTANTE: Siempre inicializar con un objeto válido de scales
    const [formData, setFormData] = useState<OpportunityFormData>({
      name: opportunity?.name || '',
      client: opportunity?.client || '',
      vendor: opportunity?.vendor || currentUser || vendors[0]?.name || '',
      value: opportunity?.value?.toString() || '',
      stage: opportunity?.stage || 1,
      priority: opportunity?.priority || 'media',
      expected_close: opportunity?.expected_close || '',
      next_action: opportunity?.next_action || '',
      product: opportunity?.product || '',
      power_sponsor: opportunity?.power_sponsor || '',
      sponsor: opportunity?.sponsor || '',
      influencer: opportunity?.influencer || '',
      support_contact: opportunity?.support_contact || '',
      scales: opportunity?.scales || emptyScales(), // SIEMPRE un objeto válido
      industry: opportunity?.industry || ''
    });

    const [activeScale, setActiveScale] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showScaleSelector, setShowScaleSelector] = useState<string | null>(null);

    const handleSubmit = async () => {
      // Validaciones mejoradas
      if (!formData.name?.trim()) {
        alert('❌ Por favor, ingrese el nombre de la oportunidad');
        return;
      }
      
      if (!formData.client?.trim()) {
        alert('❌ Por favor, ingrese el nombre del cliente');
        return;
      }
      
      const valueNum = parseFloat(formData.value?.toString() || '0');
      if (isNaN(valueNum) || valueNum <= 0) {
        alert('❌ Por favor, ingrese un valor válido mayor a 0');
        return;
      }

      setSubmitting(true);
      
      try {
        // Asegurar que scales existe antes de enviar
        const dataToSend = {
          ...formData,
          scales: formData.scales || emptyScales()
        };
        
        const success = opportunity 
          ? await updateOpportunity(opportunity.id, dataToSend)
          : await createOpportunity(dataToSend);
          
        if (success) {
          onClose();
          // Limpiar selección si se editó
          if (opportunity && selectedOpportunity?.id === opportunity.id) {
            setSelectedOpportunity(null);
          }
        }
      } finally {
        setSubmitting(false);
      }
    };

    const updateScale = (scaleId: string, field: 'score' | 'description', value: string | number) => {
      // Validar score entre 0 y 10
      if (field === 'score') {
        const numValue = typeof value === 'string' ? parseInt(value) : value;
        if (numValue < 0 || numValue > 10) return;
      }
      
      setFormData(prev => ({
        ...prev,
        scales: {
          ...prev.scales,
          [scaleId]: {
            ...prev.scales[scaleId as keyof Scales],
            [field]: field === 'score' ? (typeof value === 'string' ? parseInt(value) || 0 : value) : value
          }
        }
      }));
    };

    const selectScaleLevel = (scaleId: string, level: number, description: string) => {
      updateScale(scaleId, 'score', level);
      updateScale(scaleId, 'description', description);
      setShowScaleSelector(null);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-xl max-w-6xl w-full my-8">
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  {opportunity ? '✏️ Editar Oportunidad' : '➕ Nueva Oportunidad'}
                </h2>
                <p className="text-gray-600 mt-1">
                  {opportunity ? 'Actualice los datos de la oportunidad' : 'Agregue una nueva oportunidad al pipeline Ventapel'}
                </p>
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={submitting}
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
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Solución de Cierre Amazon"
                        disabled={submitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Cliente *</label>
                      <input
                        type="text"
                        value={formData.client}
                        onChange={(e) => setFormData({...formData, client: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Nombre de la empresa"
                        disabled={submitting}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Vendedor *</label>
                        <select
                          value={formData.vendor}
                          onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={submitting || (!currentVendorInfo?.is_admin && !!currentUser)}
                        >
                          {vendors.map(vendor => (
                            <option key={vendor.name} value={vendor.name}>
                              {vendor.name} {vendor.role && `(${vendor.role})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Valor (R$) *</label>
                        <input
                          type="number"
                          value={formData.value}
                          onChange={(e) => setFormData({...formData, value: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="250000"
                          disabled={submitting}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Etapa *</label>
                        <select
                          value={formData.stage}
                          onChange={(e) => setFormData({...formData, stage: parseInt(e.target.value)})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={submitting}
                        >
                          {stages.slice(0, 5).map(stage => (
                            <option key={stage.id} value={stage.id}>
                              {stage.name} ({stage.probability}%)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Prioridad</label>
                        <select
                          value={formData.priority}
                          onChange={(e) => setFormData({...formData, priority: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={submitting}
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
                          value={formData.product}
                          onChange={(e) => setFormData({...formData, product: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: Máquinas BP + Cinta"
                          disabled={submitting}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Industria</label>
                        <input
                          type="text"
                          value={formData.industry}
                          onChange={(e) => setFormData({...formData, industry: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: E-commerce, Farmacéutica"
                          disabled={submitting}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Cierre Previsto</label>
                        <input
                          type="date"
                          value={formData.expected_close}
                          onChange={(e) => setFormData({...formData, expected_close: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={submitting}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Próxima Acción</label>
                        <input
                          type="text"
                          value={formData.next_action}
                          onChange={(e) => setFormData({...formData, next_action: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: Demo técnica agendada para 15/02"
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <h3 className="text-lg font-semibold mb-4 text-green-800">👥 Contactos Principales</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Power Sponsor</label>
                      <input
                        type="text"
                        value={formData.power_sponsor}
                        onChange={(e) => setFormData({...formData, power_sponsor: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Quien firma el contrato"
                        disabled={submitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Sponsor</label>
                      <input
                        type="text"
                        value={formData.sponsor}
                        onChange={(e) => setFormData({...formData, sponsor: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Decisor usuario"
                        disabled={submitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Principal Influenciador</label>
                      <input
                        type="text"
                        value={formData.influencer}
                        onChange={(e) => setFormData({...formData, influencer: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Influye en la decisión"
                        disabled={submitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Contacto de Apoyo</label>
                      <input
                        type="text"
                        value={formData.support_contact}
                        onChange={(e) => setFormData({...formData, support_contact: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Soporte interno"
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                  <h3 className="text-lg font-semibold mb-4 text-purple-800">📊 Escalas PPVVCC</h3>
                  <div className="space-y-4">
                    {scales.map(scale => {
                      const Icon = scale.icon;
                      const scaleData = formData.scales[scale.id as keyof Scales];
                      const isActive = activeScale === scale.id;
                      const isSelectorOpen = showScaleSelector === scale.id;

                      return (
                        <div key={scale.id} className={scale.bgColor + ' ' + scale.borderColor + ' border-2 rounded-lg p-4 transition-all ' + (isActive ? 'ring-2 ring-purple-400' : '')}>
                          <div 
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setActiveScale(isActive ? null : scale.id)}
                          >
                            <div className="flex items-center">
                              <Icon className={'w-5 h-5 mr-3 ' + scale.color} />
                              <div>
                                <span className="font-bold text-sm">{scale.name}</span>
                                <p className="text-xs text-gray-600">{scale.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-2xl font-bold">{scaleData.score}</span>
                              <ChevronRight className={'w-4 h-4 transition-transform ' + (isActive ? 'rotate-90' : '')} />
                            </div>
                          </div>

                          {isActive && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="space-y-3">
                                <div>
                                  <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium">Score (0-10)</label>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowScaleSelector(isSelectorOpen ? null : scale.id);
                                      }}
                                      className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 transition-colors flex items-center"
                                    >
                                      Ver opciones de escala
                                      {isSelectorOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                                    </button>
                                  </div>

                                  {isSelectorOpen && (
                                    <div className="mb-4 bg-white rounded-lg p-3 max-h-60 overflow-y-auto border border-purple-200">
                                      {scaleDefinitions[scale.id as keyof typeof scaleDefinitions].map((def) => (
                                        <button
                                          key={def.level}
                                          type="button"
                                          onClick={() => selectScaleLevel(scale.id, def.level, def.text)}
                                          className={'w-full text-left p-2 mb-1 rounded-lg transition-colors ' + 
                                            (scaleData.score === def.level 
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
                                    value={scaleData.score}
                                    onChange={(e) => updateScale(scale.id, 'score', parseInt(e.target.value))}
                                    className="w-full"
                                    disabled={submitting}
                                  />
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>0</span>
                                    <span className="font-bold">{scaleData.score}</span>
                                    <span>10</span>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-2">Observaciones</label>
                                  <textarea
                                    value={scaleData.description}
                                    onChange={(e) => updateScale(scale.id, 'description', e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="Describa la situación actual..."
                                    disabled={submitting}
                                  />
                                </div>
                                <div className="bg-white p-3 rounded-lg">
                                  <p className="text-xs font-medium text-gray-700 mb-2">Preguntas clave:</p>
                                  <ul className="text-xs text-gray-600 space-y-1">
                                    {scale.questions?.map((question, idx) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-purple-500 mr-2">•</span>
                                        {question}
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
                onClick={onClose}
                className="px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 flex items-center transition-colors font-medium disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? (
                  <React.Fragment>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <Save className="w-5 h-5 mr-2" />
                    {opportunity ? 'Actualizar' : 'Crear'} Oportunidad
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
  const StageChecklistModal = () => {
    if (!showStageChecklist) return null;

    const currentStage = stages.find(s => s.id === showStageChecklist.opportunity.stage);
    const targetStage = stages.find(s => s.id === showStageChecklist.targetStage);
    
    const initCheckedItems = () => {
      const items: {[key: string]: boolean} = {};
      if (currentStage?.checklist) {
        Object.values(currentStage.checklist).forEach(key => {
          items[key] = false;
        });
      }
      return items;
    };
    
    const [checkedItems, setCheckedItems] = useState<{[key: string]: boolean}>(initCheckedItems);

    if (!currentStage || !targetStage) return null;

    const handleCheckChange = (key: string) => {
      setCheckedItems(prev => ({...prev, [key]: !prev[key]}));
    };

    const allChecked = currentStage.checklist && Object.values(currentStage.checklist).every(key => checkedItems[key] === true);

    const confirmStageChange = async () => {
      if (!allChecked) {
        alert('Por favor, complete todos los ítems del checklist antes de avanzar.');
        return;
      }

      try {
        await moveStage(showStageChecklist.opportunity, showStageChecklist.targetStage);
        setShowStageChecklist(null);
      } catch (error) {
        console.error('Error al mover etapa:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-2xl w-full">
          <div className="p-6 border-b">
            <h3 className="text-xl font-bold text-gray-900">
              ✅ Checklist para avanzar a {targetStage.name}
            </h3>
            <p className="text-gray-600 mt-1">
              Complete todos los ítems antes de mover la oportunidad
            </p>
          </div>

          <div className="p-6">
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">📋 {showStageChecklist.opportunity.name}</h4>
              <p className="text-sm text-blue-700">{showStageChecklist.opportunity.client}</p>
            </div>

            <div className="space-y-3">
              {currentStage.checklist && Object.entries(currentStage.checklist).map(([label, key]) => {
                const isChecked = checkedItems[key] === true;
                return (
                  <label key={key} className="flex items-start p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleCheckChange(key)}
                      className="mt-0.5 mr-3 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="text-gray-800 font-medium">{label}</span>
                      {isChecked && (
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
              onClick={() => setShowStageChecklist(null)}
              className="px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmStageChange}
              className={'px-6 py-3 rounded-lg transition-colors flex items-center font-medium ' + 
                (allChecked 
                  ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white hover:from-blue-700 hover:to-green-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed')}
              disabled={!allChecked}
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
                value={currentUser || ''}
                onChange={(e) => setCurrentUser(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar vendedor...</option>
                {vendors.map(vendor => (
                  <option key={vendor.name} value={vendor.name}>
                    {vendor.name} {vendor.role && `(${vendor.role})`}
                  </option>
                ))}
              </select>
              <div className="text-right">
                <p className="text-sm font-medium text-blue-600">🌐 ventapel.com.br</p>
                <div className="flex items-center text-xs text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  {currentUser ? `${currentUser} online` : 'Online'}
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
              onClick={() => setActiveTab('dashboard')}
              className={'py-4 px-2 border-b-2 font-bold text-sm flex items-center ' + (activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700')}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              📊 Dashboard
            </button>
            <button
              onClick={() => setActiveTab('opportunities')}
              className={'py-4 px-2 border-b-2 font-bold text-sm flex items-center ' + (activeTab === 'opportunities'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700')}
            >
              <Target className="w-4 h-4 mr-2" />
              🎯 {currentVendorInfo?.is_admin ? 'Todas Oportunidades' : 'Mis Oportunidades'}
            </button>
          </div>
        </div>
      </nav>
      
<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'opportunities' && <OpportunityList />}
      </main>

      {showNewOpportunity && (
        <OpportunityForm 
          onClose={() => setShowNewOpportunity(false)} 
        />
      )}

      {editingOpportunity && (
        <OpportunityForm 
          opportunity={editingOpportunity}
          onClose={() => {
            setEditingOpportunity(null);
            setSelectedOpportunity(null);
          }} 
        />
      )}

<StageChecklistModal />
      
<AIAssistant
  currentOpportunity={selectedOpportunity || editingOpportunity}
  onOpportunityUpdate={async (updated) => {
    if (selectedOpportunity?.id === updated.id) {
      setSelectedOpportunity(updated);
    }
    if (editingOpportunity?.id === updated.id) {
      setEditingOpportunity(updated);
    }
  }}
  currentUser={currentUser}
  supabase={supabase}  // ← 🟢 AGREGAR ESTA LÍNEA
/>
    </div>
  );
};

// --- APP WRAPPER CON PROVIDER ---
const App: React.FC = () => {
  return (
    <OpportunitiesProvider>
      <CRMVentapel />
    </OpportunitiesProvider>
  );
};

export default App;
