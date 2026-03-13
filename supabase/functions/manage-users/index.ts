import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action, nome, email, password, role, userId } = body
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // 1. CRIAR
    if (action === 'create') {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })
      if (authErr) throw authErr

      const { error: dbErr } = await supabaseAdmin.from('users').upsert([{ id: authData.user.id, email, nome, role }])
      if (dbErr) throw dbErr
    }

    // 2. ATUALIZAR (Edita nome e cargo na tabela pública)
    if (action === 'update') {
      const { error: dbErr } = await supabaseAdmin.from('users').update({ nome, role }).eq('id', userId)
      if (dbErr) throw dbErr
    }

    // 3. DELETAR (Apaga do Auth, o que apaga o acesso do usuário)
    if (action === 'delete') {
      const { error: dbErr } = await supabaseAdmin.from('users').delete().eq('id', userId)
      if (dbErr) throw dbErr
      
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (authErr) throw authErr
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})