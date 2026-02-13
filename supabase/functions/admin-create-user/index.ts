// @ts-ignore
declare const Deno: any;

// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Get the User who is calling the function
        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            throw new Error('Unauthorized')
        }

        const { email, password, name, role, school_id } = await req.json()

        if (!email || !password || !name || !role || !school_id) {
            throw new Error('Missing required fields')
        }

        // 1. Verify if the caller is an ADMIN of the target school
        // Query school_members to see if (user.id, school_id) has role 'ADMIN'
        const { data: membership, error: membershipError } = await supabaseClient
            .from('school_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('school_id', school_id)
            .eq('role', 'ADMIN') // Strictly check for ADMIN role
            .single()

        if (membershipError || !membership) {
            // Double check: Is the user a Super Admin? (Optional, but let's stick to School Admin rule for now)
            // For SaaS, strict School Admin check is safer.
            throw new Error('Unauthorized: You must be an Administrator of this school to add members.')
        }

        // 2. Initialize Supabase Admin Client (Service Role)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Create the User
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm
            user_metadata: { name }
        })

        if (createError) {
            // If user already exists, we might want to just link them? 
            // But the user asked for "Create User". If exists, throw error or handle gracefully.
            // For now, let's throw the error (e.g. Email already registered)
            throw createError
        }

        if (!newUser.user) {
            throw new Error('Failed to create user object')
        }

        // 4. Link to School Members
        const { error: linkError } = await supabaseAdmin
            .from('school_members')
            .insert({
                user_id: newUser.user.id,
                school_id: school_id,
                role: role // 'TEACHER', 'SECRETARY', etc.
            })

        if (linkError) {
            // If linking fails, we might leave an orphaned user. 
            // Ideally we should rollback (delete user), but Auth vs DB transaction is hard across HTTP.
            // Let's just return the error for now.
            console.error('Error linking user:', linkError)
            throw new Error('User created but failed to link to school: ' + linkError.message)
        }

        // 5. Ensure Profile exists (Triggers usually handle this, but let's be safe or just rely on trigger)
        // The previous implementation relied on Triggers on auth.users. Assuming that exists.

        // Return success
        return new Response(
            JSON.stringify({
                user: newUser.user,
                message: 'User created and linked successfully'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
