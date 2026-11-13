/**
 * Panel paginado de recomendaciones calculadas exclusivamente en el backend.
 * Cerrar el panel cancela la consulta; abrirlo o cambiar página/revisión vuelve
 * a solicitar resultados. Este hook no calcula score ni añade señales de interés.
 */
import { useEffect,useState } from 'react';
import { loadDigitalRecommendations } from '../api/elibraryApi';
import type { RecommendedDigitalPublication } from '../types/publication';
/**
 * Devuelve apertura, página, datos, carga, error y acciones de navegación/reintento.
 * La señal del efecto impide aplicar una respuesta después de cerrar o cambiar página.
 */
export function useDigitalRecommendations(){
  const [open,setOpen]=useState(true),[items,setItems]=useState<RecommendedDigitalPublication[]>([]),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{if(!open)return;const abort=new AbortController();setLoading(true);setError(false);setItems([]);setHasMore(false);void loadDigitalRecommendations(page,abort.signal).then(result=>{if(!abort.signal.aborted){setItems(result.data);setHasMore(result.meta.hasMore);}}).catch(()=>{if(!abort.signal.aborted)setError(true);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[open,page,revision]);
  return{open,toggle:()=>setOpen(value=>!value),items,page,hasMore,loading,error,reload:()=>setRevision(value=>value+1),next:()=>setPage(value=>value+1),previous:()=>setPage(value=>Math.max(1,value-1))};
}
