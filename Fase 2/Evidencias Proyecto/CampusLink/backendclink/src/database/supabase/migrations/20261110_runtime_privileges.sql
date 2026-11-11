-- Dedicated trusted API connection. No membership in authenticator/service_role; never used by clients.
GRANT CONNECT ON DATABASE postgres TO campuslink_api;
GRANT USAGE ON SCHEMA public TO campuslink_api;
GRANT SELECT ON public.campuslink_auth_directory TO campuslink_api;
GRANT SELECT ON public.institucion,public.campus,public.carrera,public.asignatura,public.campus_carrera,
 public.carrera_asignatura,public.perfil_usuario,public.usuario_carrera,public.usuario_asignatura,
 public.rol,public.permiso,public.rol_permiso,public.usuario_rol,public.usuario_permiso,
 public.publicacion_recurso,public.recurso_digital,public.categoria_recurso_fisico,public.recurso_fisico,
 public.archivo_publicacion,public.publicacion_carrera,public.publicacion_asignatura,public.mensaje_solicitud,
 public.solicitud_recurso,public.transaccion_recurso,public.confirmacion_transaccion,public.valoracion,
 public.acceso_recurso_digital,public.notificacion,public.interaccion_recurso,public.reporte_contenido,
 public.auditoria,public.reporte,public.dominio_institucional TO campuslink_api;
GRANT INSERT ON public.acceso_recurso_digital,public.archivo_publicacion,public.auditoria,
 public.confirmacion_transaccion,public.interaccion_recurso,public.notificacion,public.publicacion_asignatura,
 public.publicacion_carrera,public.publicacion_recurso,public.recurso_digital,public.recurso_fisico,
 public.reporte,public.reporte_contenido,public.solicitud_recurso,public.transaccion_recurso,
 public.usuario_carrera,public.usuario_rol,public.usuario_permiso,public.valoracion TO campuslink_api;
GRANT UPDATE ON public.archivo_publicacion,public.notificacion,public.perfil_usuario,public.publicacion_recurso,
 public.recurso_fisico,public.reporte_contenido,public.solicitud_recurso,public.transaccion_recurso,
 public.usuario_rol,public.usuario_permiso TO campuslink_api;
GRANT DELETE ON public.publicacion_asignatura,public.publicacion_carrera,public.usuario_carrera TO campuslink_api;
-- PostgreSQL requires an UPDATE privilege for SELECT ... FOR SHARE. Limit it to one column on catalogs.
GRANT UPDATE (id) ON public.institucion,public.campus,public.carrera,public.asignatura,public.rol,
 public.permiso,public.categoria_recurso_fisico TO campuslink_api;
GRANT UPDATE (campus_id) ON public.campus_carrera TO campuslink_api;
GRANT UPDATE (carrera_id) ON public.carrera_asignatura TO campuslink_api;
GRANT UPDATE (codigo) ON public.mensaje_solicitud TO campuslink_api;
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='public'
   AND has_table_privilege('campuslink_api',format('%I.%I',schemaname,tablename),'SELECT') LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=item.tablename AND policyname='campuslink_api_access') THEN
   EXECUTE format('CREATE POLICY campuslink_api_access ON public.%I TO campuslink_api USING (true) WITH CHECK (true)',item.tablename);
  END IF;
 END LOOP;
END $$;
