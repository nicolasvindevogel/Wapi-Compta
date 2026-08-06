import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = req.headers.get('Authorization') || ''
    if (!authorization) throw new Error('Session utilisateur absente.')

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: authData, error: authError } = await callerClient.auth.getUser()
    if (authError || !authData.user) throw new Error('Session invalide.')

    const adminClient = createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: profile } = await adminClient.from('compta_user_profiles').select('role,active').eq('id', authData.user.id).maybeSingle()
    if (!profile || profile.role !== 'admin' || profile.active === false) throw new Error('Seul un administrateur peut créer un accès.')

    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const displayName = String(body.display_name || '').trim()
    if (!email || password.length < 8 || !displayName) throw new Error('Nom, e-mail et mot de passe de 8 caractères minimum requis.')

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: displayName, name: displayName }
    })
    if (createError) throw createError

    const { error: profileError } = await adminClient.from('compta_user_profiles').upsert({
      id: created.user.id,
      email,
      display_name: displayName,
      role: body.role === 'admin' ? 'admin' : 'gestionnaire',
      active: true,
      phone: body.phone || null,
      initials: body.initials || null,
      updated_at: new Date().toISOString(),
    })
    if (profileError) throw profileError

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
