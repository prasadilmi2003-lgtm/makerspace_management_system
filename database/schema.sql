-- ... (Previous setup code, I will write the full schema file again) ...
-- Makerspace Management System - Supabase PostgreSQL Schema

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Custom Types (Enums)
CREATE TYPE user_role AS ENUM ('Superadmin', 'Keyholder', 'User', 'Alumni', 'Pending');
CREATE TYPE user_status AS ENUM ('Active', 'Pending_Signature', 'Requires_Reagreement', 'Suspended');
CREATE TYPE request_status AS ENUM ('Pending', 'Claimed', 'Key_Retrieved', 'Active', 'Overdue', 'Completed', 'Cancelled');

-- 3. Tables

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    student_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    academic_year TEXT,
    department TEXT,
    role user_role NOT NULL DEFAULT 'Pending',
    status user_status NOT NULL DEFAULT 'Pending_Signature',
    penalty_box BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE procedure_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_string TEXT NOT NULL UNIQUE,
    document_url TEXT NOT NULL,
    content TEXT,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE liability_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    procedure_version_id UUID NOT NULL REFERENCES procedure_versions(id) ON DELETE RESTRICT,
    signed_name TEXT NOT NULL,
    signed_student_id TEXT NOT NULL,
    ip_address TEXT,
    agreed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    preferred_date DATE NOT NULL,
    estimated_duration_mins INTEGER NOT NULL,
    status request_status NOT NULL DEFAULT 'Pending',
    assigned_keyholder_id UUID REFERENCES users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    estimated_end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE key_handoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE RESTRICT,
    keyholder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    retrieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
    retrieved_from_officer TEXT NOT NULL,
    returned_at TIMESTAMP WITH TIME ZONE,
    returned_to_officer TEXT,
    was_overdue BOOLEAN DEFAULT false
);

CREATE TABLE penalty_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyholder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    cleared_at TIMESTAMP WITH TIME ZONE,
    clearing_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    condition TEXT NOT NULL DEFAULT 'Good',
    status TEXT NOT NULL DEFAULT 'Available',
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE inventory_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE floor_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone TEXT NOT NULL,
    bench TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 4. Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE liability_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_allocations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Users: Anyone can view profiles. Users can only update specific non-privileged fields (not role, status, penalty_box).
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own non-privileged profile data" ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (
    -- This ensures they can't change their role or status through a standard update
    role = (SELECT role FROM users WHERE id = auth.uid()) AND
    status = (SELECT status FROM users WHERE id = auth.uid()) AND
    penalty_box = (SELECT penalty_box FROM users WHERE id = auth.uid())
);

-- Procedures: Anyone can view active versions.
CREATE POLICY "Anyone can view active procedure versions" ON procedure_versions FOR SELECT USING (active = true);

-- Liability Signatures: Users can view their own. No direct inserts (handled by RPC).
CREATE POLICY "Users can view own signatures" ON liability_signatures FOR SELECT USING (auth.uid() = user_id);

-- Audit Log: Superadmin reads. No direct inserts/updates/deletes.
CREATE POLICY "Superadmin can read audit log" ON audit_log FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'Superadmin'
);

-- 6. Functions and Triggers

-- Trigger: New Auth User -> public.users sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, student_id, email, academic_year, department, role, status)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'student_id',
    new.email,
    new.raw_user_meta_data->>'academic_year',
    new.raw_user_meta_data->>'department',
    'Pending',
    'Pending_Signature'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RPC: Sign Liability Agreement
-- This securely inserts the signature, logs the audit event, and activates the user.
CREATE OR REPLACE FUNCTION sign_liability(
    p_procedure_version_id UUID,
    p_signed_name TEXT,
    p_signed_student_id TEXT,
    p_ip_address TEXT
) RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_actual_name TEXT;
    v_actual_student_id TEXT;
    v_proc_version TEXT;
    v_user_role user_role;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify user data
    SELECT full_name, student_id, role INTO v_actual_name, v_actual_student_id, v_user_role
    FROM users WHERE id = v_user_id;

    IF v_actual_name != p_signed_name THEN
        RAISE EXCEPTION 'Signed name does not match registered name';
    END IF;

    IF v_actual_student_id != p_signed_student_id THEN
        RAISE EXCEPTION 'Signed student ID does not match registered ID';
    END IF;

    -- Verify procedure is active
    SELECT version_string INTO v_proc_version
    FROM procedure_versions
    WHERE id = p_procedure_version_id AND active = true;

    IF v_proc_version IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive procedure version';
    END IF;

    -- Insert signature
    INSERT INTO liability_signatures (user_id, procedure_version_id, signed_name, signed_student_id, ip_address)
    VALUES (v_user_id, p_procedure_version_id, p_signed_name, p_signed_student_id, p_ip_address);

    -- Upgrade status
    UPDATE users SET status = 'Active' WHERE id = v_user_id;

    -- If role is pending, upgrade to User (if Superadmin hasn't set them to Keyholder yet, etc)
    IF v_user_role = 'Pending' THEN
        UPDATE users SET role = 'User' WHERE id = v_user_id;
    END IF;

    -- Insert audit log
    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (
        v_user_id,
        'SIGNATURE_CAPTURED',
        'liability_signatures',
        v_user_id,
        jsonb_build_object('version', v_proc_version, 'ip', p_ip_address)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Immutability Triggers
-- Prevent liability_signatures modification
CREATE OR REPLACE FUNCTION prevent_liability_modification()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Liability signatures cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_liability_update
BEFORE UPDATE ON liability_signatures
FOR EACH ROW EXECUTE PROCEDURE prevent_liability_modification();

CREATE TRIGGER prevent_liability_delete
BEFORE DELETE ON liability_signatures
FOR EACH ROW EXECUTE PROCEDURE prevent_liability_modification();

-- Prevent audit_log modification
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit log records cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_log_update
BEFORE UPDATE ON audit_log
FOR EACH ROW EXECUTE PROCEDURE prevent_audit_log_modification();

CREATE TRIGGER prevent_audit_log_delete
BEFORE DELETE ON audit_log
FOR EACH ROW EXECUTE PROCEDURE prevent_audit_log_modification();
- -   0 0 1 _ r e q u e s t _ l i f e c y c l e . s q l  
  
 - -   R L S   f o r   r e q u e s t s  
 A L T E R   T A B L E   r e q u e s t s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   o w n   r e q u e s t s "   O N   r e q u e s t s  
         F O R   S E L E C T   U S I N G   ( a u t h . u i d ( )   =   s t u d e n t _ i d ) ;  
  
 C R E A T E   P O L I C Y   " K e y h o l d e r s   a n d   A d m i n s   c a n   v i e w   a l l   r e q u e s t s "   O N   r e q u e s t s  
         F O R   S E L E C T   U S I N G   (  
                 ( S E L E C T   r o l e   F R O M   u s e r s   W H E R E   i d   =   a u t h . u i d ( ) )   I N   ( ' K e y h o l d e r ' ,   ' S u p e r a d m i n ' )  
         ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   i n s e r t   o w n   r e q u e s t s "   O N   r e q u e s t s  
         F O R   I N S E R T   W I T H   C H E C K   (  
                 a u t h . u i d ( )   =   s t u d e n t _ i d   A N D  
                 ( S E L E C T   s t a t u s   F R O M   u s e r s   W H E R E   i d   =   a u t h . u i d ( ) )   =   ' A c t i v e '  
         ) ;  
  
 - -   U s e r s   c a n   u p d a t e   t h e i r   o w n   r e q u e s t   o n l y   i f   i t ' s   p e n d i n g   ( e . g .   t o   c a n c e l   i t )  
 C R E A T E   P O L I C Y   " U s e r s   c a n   c a n c e l   o w n   p e n d i n g   r e q u e s t s "   O N   r e q u e s t s  
         F O R   U P D A T E   U S I N G   (  
                 a u t h . u i d ( )   =   s t u d e n t _ i d   A N D   s t a t u s   =   ' P e n d i n g '  
         )   W I T H   C H E C K   (  
                 s t a t u s   =   ' C a n c e l l e d '  
         ) ;  
  
 - -   R P C   f o r   C l a i m i n g   a   R e q u e s t  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   c l a i m _ r e q u e s t ( p _ r e q u e s t _ i d   U U I D )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ u s e r _ i d   U U I D   : =   a u t h . u i d ( ) ;  
         v _ r o l e   u s e r _ r o l e ;  
         v _ p e n a l t y   B O O L E A N ;  
         v _ r e q _ s t a t u s   r e q u e s t _ s t a t u s ;  
 B E G I N  
         - -   V e r i f y   u s e r  
         S E L E C T   r o l e ,   p e n a l t y _ b o x   I N T O   v _ r o l e ,   v _ p e n a l t y  
         F R O M   u s e r s   W H E R E   i d   =   v _ u s e r _ i d ;  
  
         I F   v _ r o l e   N O T   I N   ( ' K e y h o l d e r ' ,   ' S u p e r a d m i n ' )   T H E N  
                 R A I S E   E X C E P T I O N   ' O n l y   K e y h o l d e r s   o r   S u p e r a d m i n s   c a n   c l a i m   r e q u e s t s ' ;  
         E N D   I F ;  
  
         I F   v _ p e n a l t y   =   t r u e   T H E N  
                 R A I S E   E X C E P T I O N   ' K e y h o l d e r   i s   i n   t h e   p e n a l t y   b o x   a n d   c a n n o t   c l a i m   r e q u e s t s ' ;  
         E N D   I F ;  
  
         - -   V e r i f y   r e q u e s t  
         S E L E C T   s t a t u s   I N T O   v _ r e q _ s t a t u s  
         F R O M   r e q u e s t s   W H E R E   i d   =   p _ r e q u e s t _ i d   F O R   U P D A T E ;   - -   l o c k   r o w  
  
         I F   v _ r e q _ s t a t u s   ! =   ' P e n d i n g '   T H E N  
                 R A I S E   E X C E P T I O N   ' R e q u e s t   i s   n o t   i n   P e n d i n g   s t a t e ' ;  
         E N D   I F ;  
  
         - -   U p d a t e   R e q u e s t  
         U P D A T E   r e q u e s t s  
         S E T   s t a t u s   =   ' C l a i m e d ' ,   a s s i g n e d _ k e y h o l d e r _ i d   =   v _ u s e r _ i d ,   c l a i m e d _ a t   =   n o w ( )  
         W H E R E   i d   =   p _ r e q u e s t _ i d ;  
  
         - -   A u d i t   L o g  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ u s e r _ i d ,   ' R E Q U E S T _ C L A I M E D ' ,   ' r e q u e s t s ' ,   p _ r e q u e s t _ i d ,   ' { } ' : : j s o n b ) ;  
  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 - -   R P C   f o r   C a n c e l l i n g   a   R e q u e s t   ( b y   K e y h o l d e r / A d m i n )  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   c a n c e l _ r e q u e s t ( p _ r e q u e s t _ i d   U U I D ,   p _ r e a s o n   T E X T )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ u s e r _ i d   U U I D   : =   a u t h . u i d ( ) ;  
         v _ r o l e   u s e r _ r o l e ;  
         v _ r e q _ s t a t u s   r e q u e s t _ s t a t u s ;  
 B E G I N  
         S E L E C T   r o l e   I N T O   v _ r o l e   F R O M   u s e r s   W H E R E   i d   =   v _ u s e r _ i d ;  
          
         I F   v _ r o l e   N O T   I N   ( ' K e y h o l d e r ' ,   ' S u p e r a d m i n ' )   T H E N  
                 R A I S E   E X C E P T I O N   ' N o t   a u t h o r i z e d ' ;  
         E N D   I F ;  
  
         S E L E C T   s t a t u s   I N T O   v _ r e q _ s t a t u s   F R O M   r e q u e s t s   W H E R E   i d   =   p _ r e q u e s t _ i d   F O R   U P D A T E ;  
  
         I F   v _ r e q _ s t a t u s   I N   ( ' C o m p l e t e d ' ,   ' C a n c e l l e d ' )   T H E N  
                 R A I S E   E X C E P T I O N   ' R e q u e s t   c a n n o t   b e   c a n c e l l e d   f r o m   c u r r e n t   s t a t e ' ;  
         E N D   I F ;  
  
         U P D A T E   r e q u e s t s   S E T   s t a t u s   =   ' C a n c e l l e d '   W H E R E   i d   =   p _ r e q u e s t _ i d ;  
  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ u s e r _ i d ,   ' R E Q U E S T _ C A N C E L L E D ' ,   ' r e q u e s t s ' ,   p _ r e q u e s t _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' r e a s o n ' ,   p _ r e a s o n ) ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
 - -   0 0 2 _ k e y _ m a n a g e m e n t . s q l  
  
 - -   R P C   f o r   R e t r i e v e   K e y  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   r e t r i e v e _ k e y ( p _ r e q u e s t _ i d   U U I D ,   p _ o f f i c e r _ n a m e   T E X T )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ u s e r _ i d   U U I D   : =   a u t h . u i d ( ) ;  
         v _ r e q _ s t a t u s   r e q u e s t _ s t a t u s ;  
         v _ a s s i g n e d _ i d   U U I D ;  
         v _ d u r a t i o n   I N T E G E R ;  
 B E G I N  
         S E L E C T   s t a t u s ,   a s s i g n e d _ k e y h o l d e r _ i d ,   e s t i m a t e d _ d u r a t i o n _ m i n s  
         I N T O   v _ r e q _ s t a t u s ,   v _ a s s i g n e d _ i d ,   v _ d u r a t i o n  
         F R O M   r e q u e s t s   W H E R E   i d   =   p _ r e q u e s t _ i d   F O R   U P D A T E ;  
  
         I F   v _ r e q _ s t a t u s   ! =   ' C l a i m e d '   T H E N  
                 R A I S E   E X C E P T I O N   ' R e q u e s t   m u s t   b e   C l a i m e d   t o   r e t r i e v e   k e y ' ;  
         E N D   I F ;  
  
         I F   v _ a s s i g n e d _ i d   ! =   v _ u s e r _ i d   T H E N  
                 R A I S E   E X C E P T I O N   ' O n l y   t h e   a s s i g n e d   K e y h o l d e r   c a n   r e t r i e v e   t h e   k e y ' ;  
         E N D   I F ;  
  
         - -   U p d a t e   r e q u e s t  
         U P D A T E   r e q u e s t s  
         S E T   s t a t u s   =   ' A c t i v e ' ,   e s t i m a t e d _ e n d _ t i m e   =   n o w ( )   +   ( v _ d u r a t i o n   | |   '   m i n u t e s ' ) : : i n t e r v a l  
         W H E R E   i d   =   p _ r e q u e s t _ i d ;  
  
         - -   I n s e r t   h a n d o f f   r e c o r d  
         I N S E R T   I N T O   k e y _ h a n d o f f s   ( r e q u e s t _ i d ,   k e y h o l d e r _ i d ,   r e t r i e v e d _ f r o m _ o f f i c e r )  
         V A L U E S   ( p _ r e q u e s t _ i d ,   v _ u s e r _ i d ,   p _ o f f i c e r _ n a m e ) ;  
  
         - -   A u d i t   L o g  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ u s e r _ i d ,   ' K E Y _ R E T R I E V E D ' ,   ' r e q u e s t s ' ,   p _ r e q u e s t _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' o f f i c e r ' ,   p _ o f f i c e r _ n a m e ) ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 - -   R P C   f o r   R e t u r n   K e y  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   r e t u r n _ k e y ( p _ r e q u e s t _ i d   U U I D ,   p _ o f f i c e r _ n a m e   T E X T )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ u s e r _ i d   U U I D   : =   a u t h . u i d ( ) ;  
         v _ r e q _ s t a t u s   r e q u e s t _ s t a t u s ;  
         v _ a s s i g n e d _ i d   U U I D ;  
         v _ h a n d o f f _ i d   U U I D ;  
         v _ i s _ o v e r d u e   B O O L E A N   : =   f a l s e ;  
 B E G I N  
         S E L E C T   s t a t u s ,   a s s i g n e d _ k e y h o l d e r _ i d  
         I N T O   v _ r e q _ s t a t u s ,   v _ a s s i g n e d _ i d  
         F R O M   r e q u e s t s   W H E R E   i d   =   p _ r e q u e s t _ i d   F O R   U P D A T E ;  
  
         I F   v _ r e q _ s t a t u s   N O T   I N   ( ' A c t i v e ' ,   ' O v e r d u e ' )   T H E N  
                 R A I S E   E X C E P T I O N   ' K e y   c a n n o t   b e   r e t u r n e d   f o r   t h i s   r e q u e s t   s t a t e ' ;  
         E N D   I F ;  
  
         I F   v _ a s s i g n e d _ i d   ! =   v _ u s e r _ i d   A N D   ( S E L E C T   r o l e   F R O M   u s e r s   W H E R E   i d   =   v _ u s e r _ i d )   ! =   ' S u p e r a d m i n '   T H E N  
                 R A I S E   E X C E P T I O N   ' O n l y   t h e   a s s i g n e d   K e y h o l d e r   o r   S u p e r a d m i n   c a n   r e t u r n   t h e   k e y ' ;  
         E N D   I F ;  
  
         I F   v _ r e q _ s t a t u s   =   ' O v e r d u e '   T H E N  
                 v _ i s _ o v e r d u e   : =   t r u e ;  
         E N D   I F ;  
  
         S E L E C T   i d   I N T O   v _ h a n d o f f _ i d   F R O M   k e y _ h a n d o f f s   W H E R E   r e q u e s t _ i d   =   p _ r e q u e s t _ i d   A N D   r e t u r n e d _ a t   I S   N U L L ;  
  
         U P D A T E   k e y _ h a n d o f f s  
         S E T   r e t u r n e d _ a t   =   n o w ( ) ,   r e t u r n e d _ t o _ o f f i c e r   =   p _ o f f i c e r _ n a m e ,   w a s _ o v e r d u e   =   v _ i s _ o v e r d u e  
         W H E R E   i d   =   v _ h a n d o f f _ i d ;  
  
         U P D A T E   r e q u e s t s   S E T   s t a t u s   =   ' C o m p l e t e d '   W H E R E   i d   =   p _ r e q u e s t _ i d ;  
  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ u s e r _ i d ,   ' K E Y _ R E T U R N E D ' ,   ' r e q u e s t s ' ,   p _ r e q u e s t _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' o f f i c e r ' ,   p _ o f f i c e r _ n a m e ,   ' w a s _ o v e r d u e ' ,   v _ i s _ o v e r d u e ) ) ;  
  
         - -   C l e a r   p e n a l t y   b o x   i f   t h e y   h a v e   n o   o t h e r   o v e r d u e   r e q u e s t s  
         I F   v _ i s _ o v e r d u e   T H E N  
                 I F   N O T   E X I S T S   (  
                         S E L E C T   1   F R O M   r e q u e s t s  
                         W H E R E   a s s i g n e d _ k e y h o l d e r _ i d   =   v _ a s s i g n e d _ i d   A N D   s t a t u s   =   ' O v e r d u e '  
                 )   T H E N  
                         U P D A T E   u s e r s   S E T   p e n a l t y _ b o x   =   f a l s e   W H E R E   i d   =   v _ a s s i g n e d _ i d ;  
                         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
                         V A L U E S   ( v _ u s e r _ i d ,   ' P E N A L T Y _ C L E A R E D ' ,   ' u s e r s ' ,   v _ a s s i g n e d _ i d ,   ' { " r e a s o n " :   " K e y   r e t u r n e d " } ' : : j s o n b ) ;  
                 E N D   I F ;  
         E N D   I F ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 - -   R L S   f o r   k e y _ h a n d o f f s  
 C R E A T E   P O L I C Y   " K e y h o l d e r s   a n d   A d m i n s   c a n   v i e w   k e y   h a n d o f f s "   O N   k e y _ h a n d o f f s  
         F O R   S E L E C T   U S I N G   (  
                 ( S E L E C T   r o l e   F R O M   u s e r s   W H E R E   i d   =   a u t h . u i d ( ) )   I N   ( ' K e y h o l d e r ' ,   ' S u p e r a d m i n ' )  
         ) ;  
 - -   0 0 3 _ p e n a l t y _ b o x . s q l  
  
 - -   F u n c t i o n   t o   c h e c k   f o r   o v e r d u e   r e q u e s t s   a n d   p e n a l i z e   K e y h o l d e r s  
 - -   T h i s   s h o u l d   b e   r u n   b y   p g _ c r o n   o r   a n   E d g e   F u n c t i o n   f r e q u e n t l y   ( e . g .   e v e r y   5   m i n u t e s )  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   c h e c k _ o v e r d u e _ r e q u e s t s ( )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         r   R E C O R D ;  
         v _ g r a c e _ p e r i o d _ m i n s   I N T E G E R   : =   1 2 0 ;   - -   C o n f i g u r a b l e ,   e . g .   2   h o u r s  
 B E G I N  
         F O R   r   I N  
                 S E L E C T   i d ,   a s s i g n e d _ k e y h o l d e r _ i d ,   e s t i m a t e d _ e n d _ t i m e  
                 F R O M   r e q u e s t s  
                 W H E R E   s t a t u s   =   ' A c t i v e '    
                 A N D   e s t i m a t e d _ e n d _ t i m e   +   ( v _ g r a c e _ p e r i o d _ m i n s   | |   '   m i n u t e s ' ) : : i n t e r v a l   <   n o w ( )  
         L O O P  
                 - -   M a r k   r e q u e s t   o v e r d u e  
                 U P D A T E   r e q u e s t s   S E T   s t a t u s   =   ' O v e r d u e '   W H E R E   i d   =   r . i d ;  
                  
                 - -   P e n a l i z e   K e y h o l d e r  
                 U P D A T E   u s e r s   S E T   p e n a l t y _ b o x   =   t r u e   W H E R E   i d   =   r . a s s i g n e d _ k e y h o l d e r _ i d ;  
  
                 - -   R e c o r d   P e n a l t y   E v e n t  
                 I N S E R T   I N T O   p e n a l t y _ e v e n t s   ( k e y h o l d e r _ i d ,   r e a s o n )  
                 V A L U E S   ( r . a s s i g n e d _ k e y h o l d e r _ i d ,   ' O v e r d u e   k e y   f o r   r e q u e s t   '   | |   r . i d ) ;  
  
                 - -   A u d i t   L o g  
                 I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
                 V A L U E S   ( r . a s s i g n e d _ k e y h o l d e r _ i d ,   ' P E N A L T Y _ T R I G G E R E D ' ,   ' u s e r s ' ,   r . a s s i g n e d _ k e y h o l d e r _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' r e q u e s t _ i d ' ,   r . i d ) ) ;  
         E N D   L O O P ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 - -   R P C   f o r   A d m i n   O v e r r i d e  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   o v e r r i d e _ p e n a l t y ( p _ k e y h o l d e r _ i d   U U I D ,   p _ r e a s o n   T E X T )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ a d m i n _ i d   U U I D   : =   a u t h . u i d ( ) ;  
 B E G I N  
         I F   ( S E L E C T   r o l e   F R O M   u s e r s   W H E R E   i d   =   v _ a d m i n _ i d )   ! =   ' S u p e r a d m i n '   T H E N  
                 R A I S E   E X C E P T I O N   ' O n l y   S u p e r a d m i n s   c a n   o v e r r i d e   p e n a l t i e s ' ;  
         E N D   I F ;  
  
         I F   t r i m ( p _ r e a s o n )   =   ' '   T H E N  
                 R A I S E   E X C E P T I O N   ' O v e r r i d e   r e a s o n   i s   m a n d a t o r y ' ;  
         E N D   I F ;  
  
         - -   C l e a r   p e n a l t y  
         U P D A T E   u s e r s   S E T   p e n a l t y _ b o x   =   f a l s e   W H E R E   i d   =   p _ k e y h o l d e r _ i d ;  
  
         - -   U p d a t e   p e n a l t y   e v e n t  
         U P D A T E   p e n a l t y _ e v e n t s  
         S E T   c l e a r e d _ a t   =   n o w ( ) ,   c l e a r i n g _ a d m i n _ i d   =   v _ a d m i n _ i d ,   r e a s o n   =   r e a s o n   | |   '   |   O v e r r i d e :   '   | |   p _ r e a s o n  
         W H E R E   k e y h o l d e r _ i d   =   p _ k e y h o l d e r _ i d   A N D   c l e a r e d _ a t   I S   N U L L ;  
  
         - -   A u d i t   L o g  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ a d m i n _ i d ,   ' P E N A L T Y _ C L E A R E D _ O V E R R I D E ' ,   ' u s e r s ' ,   p _ k e y h o l d e r _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' r e a s o n ' ,   p _ r e a s o n ) ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 - -   R L S   f o r   p e n a l t y _ e v e n t s  
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   o w n   p e n a l t y   e v e n t s "   O N   p e n a l t y _ e v e n t s  
         F O R   S E L E C T   U S I N G   ( a u t h . u i d ( )   =   k e y h o l d e r _ i d ) ;  
  
 C R E A T E   P O L I C Y   " S u p e r a d m i n s   c a n   v i e w   a l l   p e n a l t y   e v e n t s "   O N   p e n a l t y _ e v e n t s  
         F O R   S E L E C T   U S I N G   (  
                 ( S E L E C T   r o l e   F R O M   u s e r s   W H E R E   i d   =   a u t h . u i d ( ) )   =   ' S u p e r a d m i n '  
         ) ;  
 - -   0 0 4 _ a d m i n _ f u n c t i o n s . s q l  
  
 - -   R P C   f o r   P u b l i s h i n g   a   n e w   P r o c e d u r e   V e r s i o n  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i s h _ p r o c e d u r e _ v e r s i o n ( p _ v e r s i o n _ s t r i n g   T E X T ,   p _ d o c u m e n t _ u r l   T E X T ,   p _ c o n t e n t   T E X T )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ a d m i n _ i d   U U I D   : =   a u t h . u i d ( ) ;  
         v _ n e w _ i d   U U I D ;  
 B E G I N  
         I F   ( S E L E C T   r o l e   F R O M   u s e r s   W H E R E   i d   =   v _ a d m i n _ i d )   ! =   ' S u p e r a d m i n '   T H E N  
                 R A I S E   E X C E P T I O N   ' O n l y   S u p e r a d m i n s   c a n   p u b l i s h   p r o c e d u r e s ' ;  
         E N D   I F ;  
  
         - -   D e a c t i v a t e   o l d   v e r s i o n s  
         U P D A T E   p r o c e d u r e _ v e r s i o n s   S E T   a c t i v e   =   f a l s e   W H E R E   a c t i v e   =   t r u e ;  
  
         - -   I n s e r t   n e w   v e r s i o n  
         I N S E R T   I N T O   p r o c e d u r e _ v e r s i o n s   ( v e r s i o n _ s t r i n g ,   d o c u m e n t _ u r l ,   c o n t e n t ,   a c t i v e )  
         V A L U E S   ( p _ v e r s i o n _ s t r i n g ,   p _ d o c u m e n t _ u r l ,   p _ c o n t e n t ,   t r u e )  
         R E T U R N I N G   i d   I N T O   v _ n e w _ i d ;  
  
         - -   F o r c e   r e - a g r e e m e n t   f o r   a l l   A c t i v e   u s e r s  
         U P D A T E   u s e r s   S E T   s t a t u s   =   ' R e q u i r e s _ R e a g r e e m e n t '   W H E R E   s t a t u s   =   ' A c t i v e ' ;  
  
         - -   A u d i t   L o g  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ a d m i n _ i d ,   ' P R O C E D U R E _ P U B L I S H E D ' ,   ' p r o c e d u r e _ v e r s i o n s ' ,   v _ n e w _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' v e r s i o n ' ,   p _ v e r s i o n _ s t r i n g ) ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 - -   R P C   f o r   B u l k   R o l e   R e s e t   ( e . g .   E n d   o f   Y e a r )  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   b u l k _ r o l e _ r e s e t ( p _ u s e r _ i d s   U U I D [ ] ,   p _ n e w _ r o l e   u s e r _ r o l e )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ a d m i n _ i d   U U I D   : =   a u t h . u i d ( ) ;  
 B E G I N  
         I F   ( S E L E C T   r o l e   F R O M   u s e r s   W H E R E   i d   =   v _ a d m i n _ i d )   ! =   ' S u p e r a d m i n '   T H E N  
                 R A I S E   E X C E P T I O N   ' O n l y   S u p e r a d m i n s   c a n   r e s e t   r o l e s ' ;  
         E N D   I F ;  
  
         - -   U p d a t e   r o l e s  
         U P D A T E   u s e r s   S E T   r o l e   =   p _ n e w _ r o l e   W H E R E   i d   =   A N Y ( p _ u s e r _ i d s ) ;  
  
         - -   A u d i t   L o g  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ a d m i n _ i d ,   ' B U L K _ R O L E _ R E S E T ' ,   ' u s e r s ' ,   v _ a d m i n _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' u s e r _ c o u n t ' ,   a r r a y _ l e n g t h ( p _ u s e r _ i d s ,   1 ) ,   ' n e w _ r o l e ' ,   p _ n e w _ r o l e ) ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
 - -   0 0 5 _ i n v e n t o r y . s q l  
  
 - -   R L S   f o r   I n v e n t o r y  
 C R E A T E   P O L I C Y   " A n y o n e   c a n   v i e w   i n v e n t o r y "   O N   i n v e n t o r y _ i t e m s  
         F O R   S E L E C T   U S I N G   ( t r u e ) ;  
  
 - -   R L S   f o r   I n v e n t o r y   E v e n t s  
 C R E A T E   P O L I C Y   " K e y h o l d e r s   a n d   A d m i n s   c a n   v i e w   i n v e n t o r y   e v e n t s "   O N   i n v e n t o r y _ e v e n t s  
         F O R   S E L E C T   U S I N G   (  
                 ( S E L E C T   r o l e   F R O M   u s e r s   W H E R E   i d   =   a u t h . u i d ( ) )   I N   ( ' K e y h o l d e r ' ,   ' S u p e r a d m i n ' )  
         ) ;  
  
 - -   R P C   f o r   C h e c k i n g   O u t   I n v e n t o r y  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   c h e c k o u t _ i n v e n t o r y ( p _ i t e m _ i d   U U I D ,   p _ r e q u e s t _ i d   U U I D ,   p _ q u a n t i t y   I N T E G E R )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ u s e r _ i d   U U I D   : =   a u t h . u i d ( ) ;  
         v _ r o l e   u s e r _ r o l e ;  
         v _ c u r r e n t _ q t y   I N T E G E R ;  
 B E G I N  
         I F   p _ q u a n t i t y   < =   0   T H E N  
                 R A I S E   E X C E P T I O N   ' Q u a n t i t y   m u s t   b e   p o s i t i v e ' ;  
         E N D   I F ;  
  
         S E L E C T   r o l e   I N T O   v _ r o l e   F R O M   u s e r s   W H E R E   i d   =   v _ u s e r _ i d ;  
         I F   v _ r o l e   N O T   I N   ( ' K e y h o l d e r ' ,   ' S u p e r a d m i n ' )   T H E N  
                 R A I S E   E X C E P T I O N   ' N o t   a u t h o r i z e d ' ;  
         E N D   I F ;  
  
         S E L E C T   q u a n t i t y   I N T O   v _ c u r r e n t _ q t y   F R O M   i n v e n t o r y _ i t e m s   W H E R E   i d   =   p _ i t e m _ i d   F O R   U P D A T E ;  
  
         I F   v _ c u r r e n t _ q t y   <   p _ q u a n t i t y   T H E N  
                 R A I S E   E X C E P T I O N   ' I n s u f f i c i e n t   q u a n t i t y   a v a i l a b l e ' ;  
         E N D   I F ;  
  
         U P D A T E   i n v e n t o r y _ i t e m s  
         S E T   q u a n t i t y   =   q u a n t i t y   -   p _ q u a n t i t y ,   s t a t u s   =   C A S E   W H E N   q u a n t i t y   -   p _ q u a n t i t y   =   0   T H E N   ' C h e c k e d   O u t '   E L S E   ' A v a i l a b l e '   E N D  
         W H E R E   i d   =   p _ i t e m _ i d ;  
  
         I N S E R T   I N T O   i n v e n t o r y _ e v e n t s   ( i t e m _ i d ,   r e q u e s t _ i d ,   e v e n t _ t y p e )  
         V A L U E S   ( p _ i t e m _ i d ,   p _ r e q u e s t _ i d ,   ' c h e c k o u t ' ) ;  
  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ u s e r _ i d ,   ' I N V E N T O R Y _ C H E C K O U T ' ,   ' i n v e n t o r y _ i t e m s ' ,   p _ i t e m _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' r e q u e s t _ i d ' ,   p _ r e q u e s t _ i d ,   ' q u a n t i t y ' ,   p _ q u a n t i t y ) ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 - -   R P C   f o r   R e t u r n i n g   I n v e n t o r y  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   r e t u r n _ i n v e n t o r y ( p _ i t e m _ i d   U U I D ,   p _ r e q u e s t _ i d   U U I D ,   p _ q u a n t i t y   I N T E G E R )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ u s e r _ i d   U U I D   : =   a u t h . u i d ( ) ;  
         v _ r o l e   u s e r _ r o l e ;  
 B E G I N  
         I F   p _ q u a n t i t y   < =   0   T H E N  
                 R A I S E   E X C E P T I O N   ' Q u a n t i t y   m u s t   b e   p o s i t i v e ' ;  
         E N D   I F ;  
  
         S E L E C T   r o l e   I N T O   v _ r o l e   F R O M   u s e r s   W H E R E   i d   =   v _ u s e r _ i d ;  
         I F   v _ r o l e   N O T   I N   ( ' K e y h o l d e r ' ,   ' S u p e r a d m i n ' )   T H E N  
                 R A I S E   E X C E P T I O N   ' N o t   a u t h o r i z e d ' ;  
         E N D   I F ;  
  
         U P D A T E   i n v e n t o r y _ i t e m s  
         S E T   q u a n t i t y   =   q u a n t i t y   +   p _ q u a n t i t y ,   s t a t u s   =   ' A v a i l a b l e '  
         W H E R E   i d   =   p _ i t e m _ i d ;  
  
         I N S E R T   I N T O   i n v e n t o r y _ e v e n t s   ( i t e m _ i d ,   r e q u e s t _ i d ,   e v e n t _ t y p e )  
         V A L U E S   ( p _ i t e m _ i d ,   p _ r e q u e s t _ i d ,   ' r e t u r n ' ) ;  
  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ u s e r _ i d ,   ' I N V E N T O R Y _ R E T U R N ' ,   ' i n v e n t o r y _ i t e m s ' ,   p _ i t e m _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' r e q u e s t _ i d ' ,   p _ r e q u e s t _ i d ,   ' q u a n t i t y ' ,   p _ q u a n t i t y ) ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 - -   R P C   f o r   R e p o r t i n g   I n v e n t o r y   I s s u e  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   r e p o r t _ i n v e n t o r y _ i s s u e ( p _ i t e m _ i d   U U I D ,   p _ c o n d i t i o n   T E X T )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ u s e r _ i d   U U I D   : =   a u t h . u i d ( ) ;  
         v _ r o l e   u s e r _ r o l e ;  
 B E G I N  
         S E L E C T   r o l e   I N T O   v _ r o l e   F R O M   u s e r s   W H E R E   i d   =   v _ u s e r _ i d ;  
         I F   v _ r o l e   N O T   I N   ( ' K e y h o l d e r ' ,   ' S u p e r a d m i n ' )   T H E N  
                 R A I S E   E X C E P T I O N   ' N o t   a u t h o r i z e d ' ;  
         E N D   I F ;  
  
         I F   p _ c o n d i t i o n   N O T   I N   ( ' N o r m a l ' ,   ' D a m a g e d ' ,   ' M i s s i n g ' ,   ' N e e d s   M a i n t e n a n c e ' )   T H E N  
                 R A I S E   E X C E P T I O N   ' I n v a l i d   c o n d i t i o n ' ;  
         E N D   I F ;  
  
         U P D A T E   i n v e n t o r y _ i t e m s  
         S E T   c o n d i t i o n   =   p _ c o n d i t i o n ,   l a s t _ c h e c k e d   =   n o w ( )  
         W H E R E   i d   =   p _ i t e m _ i d ;  
  
         I N S E R T   I N T O   i n v e n t o r y _ e v e n t s   ( i t e m _ i d ,   e v e n t _ t y p e )  
         V A L U E S   ( p _ i t e m _ i d ,   p _ c o n d i t i o n ) ;  
  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ u s e r _ i d ,   ' I N V E N T O R Y _ I S S U E _ R E P O R T E D ' ,   ' i n v e n t o r y _ i t e m s ' ,   p _ i t e m _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' c o n d i t i o n ' ,   p _ c o n d i t i o n ) ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
 - -   0 0 6 _ f l o o r _ a l l o c a t i o n s . s q l  
  
 C R E A T E   P O L I C Y   " A n y o n e   c a n   v i e w   f l o o r   a l l o c a t i o n s "   O N   f l o o r _ a l l o c a t i o n s  
         F O R   S E L E C T   U S I N G   ( t r u e ) ;  
  
 - -   R P C   t o   a l l o c a t e   f l o o r  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   a l l o c a t e _ f l o o r ( p _ r e q u e s t _ i d   U U I D ,   p _ z o n e   T E X T ,   p _ b e n c h   T E X T ,   p _ s t a r t _ t i m e   T I M E S T A M P   W I T H   T I M E   Z O N E ,   p _ e n d _ t i m e   T I M E S T A M P   W I T H   T I M E   Z O N E )  
 R E T U R N S   v o i d  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         v _ u s e r _ i d   U U I D   : =   a u t h . u i d ( ) ;  
         v _ r o l e   u s e r _ r o l e ;  
         v _ s t u d e n t _ i d   U U I D ;  
 B E G I N  
         S E L E C T   r o l e   I N T O   v _ r o l e   F R O M   u s e r s   W H E R E   i d   =   v _ u s e r _ i d ;  
         I F   v _ r o l e   N O T   I N   ( ' K e y h o l d e r ' ,   ' S u p e r a d m i n ' )   T H E N  
                 R A I S E   E X C E P T I O N   ' N o t   a u t h o r i z e d ' ;  
         E N D   I F ;  
  
         - -   G e t   s t u d e n t   a s s o c i a t e d   w i t h   r e q u e s t  
         S E L E C T   s t u d e n t _ i d   I N T O   v _ s t u d e n t _ i d   F R O M   r e q u e s t s   W H E R E   i d   =   p _ r e q u e s t _ i d ;  
  
         - -   P r e v e n t   o v e r l a p  
         - -   C o n d i t i o n   h a n d l e s :   s p e c i f i c   b e n c h   o v e r l a p ,   o r   i f   e i t h e r   a l l o c a t i o n   i s   f o r   t h e   w h o l e   z o n e   ( b e n c h   I S   N U L L )  
         I F   E X I S T S   (  
                 S E L E C T   1   F R O M   f l o o r _ a l l o c a t i o n s  
                 W H E R E   z o n e   =   p _ z o n e    
                 A N D   ( b e n c h   =   p _ b e n c h   O R   b e n c h   I S   N U L L   O R   p _ b e n c h   I S   N U L L )  
                 A N D   s t a r t _ t i m e   <   p _ e n d _ t i m e   A N D   e n d _ t i m e   >   p _ s t a r t _ t i m e  
         )   T H E N  
                 R A I S E   E X C E P T I O N   ' F l o o r   a l l o c a t i o n   o v e r l a p s   w i t h   a n   e x i s t i n g   a l l o c a t i o n ' ;  
         E N D   I F ;  
  
         I N S E R T   I N T O   f l o o r _ a l l o c a t i o n s   ( r e q u e s t _ i d ,   u s e r _ i d ,   z o n e ,   b e n c h ,   s t a r t _ t i m e ,   e n d _ t i m e )  
         V A L U E S   ( p _ r e q u e s t _ i d ,   v _ s t u d e n t _ i d ,   p _ z o n e ,   p _ b e n c h ,   p _ s t a r t _ t i m e ,   p _ e n d _ t i m e ) ;  
  
         I N S E R T   I N T O   a u d i t _ l o g   ( a c t o r _ i d ,   e v e n t _ t y p e ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   m e t a d a t a )  
         V A L U E S   ( v _ u s e r _ i d ,   ' F L O O R _ A L L O C A T E D ' ,   ' f l o o r _ a l l o c a t i o n s ' ,   p _ r e q u e s t _ i d ,   j s o n b _ b u i l d _ o b j e c t ( ' z o n e ' ,   p _ z o n e ,   ' b e n c h ' ,   p _ b e n c h ) ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
 - -   0 0 7 _ p r o j e c t _ r e p o s i t o r y . s q l  
  
 C R E A T E   T A B L E   p r o j e c t s   (  
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   u u i d _ g e n e r a t e _ v 4 ( ) ,  
         t i t l e   T E X T   N O T   N U L L ,  
         d e s c r i p t i o n   T E X T   N O T   N U L L ,  
         c a t e g o r y   T E X T   N O T   N U L L ,  
         s t a t u s   T E X T   N O T   N U L L   D E F A U L T   ' A c t i v e ' ,  
         o w n e r _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   u s e r s ( i d )   O N   D E L E T E   C A S C A D E ,  
         m e d i a _ u r l s   T E X T [ ] ,  
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   t i m e z o n e ( ' u t c ' ,   n o w ( ) )   N O T   N U L L  
 ) ;  
  
 A L T E R   T A B L E   p r o j e c t s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 C R E A T E   P O L I C Y   " A n y o n e   c a n   v i e w   p r o j e c t s "   O N   p r o j e c t s  
         F O R   S E L E C T   U S I N G   ( t r u e ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   c r e a t e   p r o j e c t s "   O N   p r o j e c t s  
         F O R   I N S E R T   W I T H   C H E C K   (  
                 a u t h . u i d ( )   =   o w n e r _ i d   A N D  
                 ( S E L E C T   s t a t u s   F R O M   u s e r s   W H E R E   i d   =   a u t h . u i d ( ) )   =   ' A c t i v e '  
         ) ;  
  
 C R E A T E   P O L I C Y   " S u p e r a d m i n   c a n   u p d a t e   p r o j e c t s "   O N   p r o j e c t s  
         F O R   U P D A T E   U S I N G   (  
                 ( S E L E C T   r o l e   F R O M   u s e r s   W H E R E   i d   =   a u t h . u i d ( ) )   =   ' S u p e r a d m i n '  
         ) ;  
 - -   0 0 8 _ r e a l t i m e _ n o t i f i c a t i o n s . s q l  
  
 - -   E n a b l e   r e a l t i m e   f o r   s p e c i f i e d   t a b l e s  
 - -   T h i s   e n s u r e s   S u p a b a s e   R e a l t i m e   p i c k s   u p   c h a n g e s   o n   t h e s e   t a b l e s  
 A L T E R   P U B L I C A T I O N   s u p a b a s e _ r e a l t i m e   A D D   T A B L E   r e q u e s t s ;  
 A L T E R   P U B L I C A T I O N   s u p a b a s e _ r e a l t i m e   A D D   T A B L E   i n v e n t o r y _ i t e m s ;  
 A L T E R   P U B L I C A T I O N   s u p a b a s e _ r e a l t i m e   A D D   T A B L E   f l o o r _ a l l o c a t i o n s ;  
 A L T E R   P U B L I C A T I O N   s u p a b a s e _ r e a l t i m e   A D D   T A B L E   p e n a l t y _ e v e n t s ;  
  
 - -   N o t i f i c a t i o n s   A r c h i t e c t u r e  
 - -   F o r   t r u e   e m a i l   d e l i v e r y ,   S u p a b a s e   E d g e   F u n c t i o n s   +   D a t a b a s e   W e b h o o k s   a r e   r e c o m m e n d e d .  
 - -   W e   w i l l   c r e a t e   a   n o t i f i c a t i o n s   l o g   t a b l e   t h a t   a   w e b h o o k   c o u l d   l i s t e n   t o .  
  
 C R E A T E   T A B L E   n o t i f i c a t i o n _ q u e u e   (  
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   u u i d _ g e n e r a t e _ v 4 ( ) ,  
         r e c i p i e n t _ e m a i l   T E X T   N O T   N U L L ,  
         s u b j e c t   T E X T   N O T   N U L L ,  
         b o d y   T E X T   N O T   N U L L ,  
         s t a t u s   T E X T   N O T   N U L L   D E F A U L T   ' p e n d i n g ' ,  
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   t i m e z o n e ( ' u t c ' ,   n o w ( ) )   N O T   N U L L  
 ) ;  
  
 A L T E R   T A B L E   n o t i f i c a t i o n _ q u e u e   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 - -   D e n y   a l l   d i r e c t   a c c e s s   t o   t h e   q u e u e   e x c e p t   b y   P o s t g r e s   f u n c t i o n s   /   s u p e r a d m i n  
 C R E A T E   P O L I C Y   " S u p e r a d m i n   c a n   m a n a g e   n o t i f i c a t i o n   q u e u e "   O N   n o t i f i c a t i o n _ q u e u e  
         F O R   A L L   U S I N G   ( ( S E L E C T   r o l e   F R O M   u s e r s   W H E R E   i d   =   a u t h . u i d ( ) )   =   ' S u p e r a d m i n ' ) ;  
  
 - -   E x a m p l e   t r i g g e r   f u n c t i o n   t o   q u e u e   n o t i f i c a t i o n   o n   n e w   r e q u e s t  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   n o t i f y _ k e y h o l d e r s _ o n _ r e q u e s t ( )  
 R E T U R N S   t r i g g e r  
 S E T   s e a r c h _ p a t h   =   p u b l i c  
 A S   $ $  
 D E C L A R E  
         r   R E C O R D ;  
 B E G I N  
         F O R   r   I N   S E L E C T   e m a i l   F R O M   u s e r s   W H E R E   r o l e   =   ' K e y h o l d e r '   A N D   p e n a l t y _ b o x   =   f a l s e   L O O P  
                 I N S E R T   I N T O   n o t i f i c a t i o n _ q u e u e   ( r e c i p i e n t _ e m a i l ,   s u b j e c t ,   b o d y )  
                 V A L U E S   ( r . e m a i l ,   ' N e w   M a k e r s p a c e   R e q u e s t :   '   | |   N E W . t i t l e ,   ' A   n e w   r e q u e s t   h a s   b e e n   s u b m i t t e d   a n d   a w a i t s   c l a i m i n g . ' ) ;  
         E N D   L O O P ;  
         R E T U R N   N E W ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 C R E A T E   T R I G G E R   q u e u e _ n e w _ r e q u e s t _ n o t i f i c a t i o n  
 A F T E R   I N S E R T   O N   r e q u e s t s  
 F O R   E A C H   R O W   E X E C U T E   P R O C E D U R E   n o t i f y _ k e y h o l d e r s _ o n _ r e q u e s t ( ) ;  
 