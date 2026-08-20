-- 1. Leave request submitted → notify admins
CREATE OR REPLACE FUNCTION public.notify_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _employee_name text;
  _admin record;
BEGIN
  -- Only on new requests
  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO _employee_name FROM public.profiles WHERE id = NEW.profile_id;
    
    FOR _admin IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.profiles p ON p.user_id = ur.user_id AND p.company_id = NEW.company_id
      WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, description, priority, link_to, agent_name, status)
      VALUES (
        _admin.user_id, 'notification',
        '📋 Leave request from ' || COALESCE(_employee_name, 'Employee'),
        COALESCE(_employee_name, 'Employee') || ' requested ' || NEW.total_days || ' day(s) ' || NEW.leave_type || ' leave (' || NEW.start_date || ' → ' || NEW.end_date || ')',
        'high', '/hr', 'HR', 'unread'
      );
    END LOOP;
  END IF;

  -- Leave request approved/denied → notify employee
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('approved', 'denied') THEN
    DECLARE _emp_user_id uuid;
    BEGIN
      SELECT user_id INTO _emp_user_id FROM public.profiles WHERE id = NEW.profile_id;
      IF _emp_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, description, priority, link_to, agent_name, status)
        VALUES (
          _emp_user_id, 'notification',
          CASE WHEN NEW.status = 'approved' THEN '✅ Leave approved' ELSE '❌ Leave denied' END,
          'Your ' || NEW.leave_type || ' leave request (' || NEW.start_date || ' → ' || NEW.end_date || ') was ' || NEW.status || '.' || COALESCE(' Note: ' || NEW.review_note, ''),
          'high', '/hr', 'HR', 'unread'
        );
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_leave_request_change
  AFTER INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_leave_request();

-- 2. Human task created → notify assigned user
CREATE OR REPLACE FUNCTION public.notify_human_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _assigned_user_id uuid;
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT user_id INTO _assigned_user_id FROM public.profiles WHERE id = NEW.assigned_to;
    IF _assigned_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, description, priority, link_to, agent_name, status, metadata)
      VALUES (
        _assigned_user_id, 'todo',
        '🔔 ' || NEW.title,
        COALESCE(NEW.description, ''),
        CASE WHEN NEW.severity = 'critical' THEN 'high' ELSE 'normal' END,
        '/brain',
        'AI Agent',
        'unread',
        jsonb_build_object('human_task_id', NEW.id, 'severity', NEW.severity, 'category', NEW.category)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_human_task_created
  AFTER INSERT ON public.human_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_human_task();

-- 3. Order status changes → notify assigned sales user
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin record;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('confirmed', 'in_production', 'invoiced', 'paid', 'cancelled') THEN
    FOR _admin IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.profiles p ON p.user_id = ur.user_id AND p.company_id = NEW.company_id
      WHERE ur.role IN ('admin', 'sales', 'office')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, description, priority, link_to, agent_name, status, metadata)
      VALUES (
        _admin.user_id, 'notification',
        '📦 Order ' || COALESCE(NEW.order_number, NEW.id::text) || ' → ' || NEW.status,
        'Order status changed from ' || OLD.status || ' to ' || NEW.status,
        CASE WHEN NEW.status = 'cancelled' THEN 'high' ELSE 'normal' END,
        '/orders',
        'Orders',
        'unread',
        jsonb_build_object('order_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_status_changed
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();

-- 4. Quote request from website → notify sales/admin
CREATE OR REPLACE FUNCTION public.notify_quote_request_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin record;
BEGIN
  FOR _admin IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id AND p.company_id = NEW.company_id
    WHERE ur.role IN ('admin', 'sales')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, description, priority, link_to, agent_name, status)
    VALUES (
      _admin.user_id, 'notification',
      '🆕 Quote request: ' || COALESCE(NEW.customer_name, 'Unknown'),
      'New quote request ' || NEW.quote_number || ' from ' || COALESCE(NEW.customer_email, 'unknown'),
      'high', '/pipeline', 'Sales', 'unread'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_quote_request_push
  AFTER INSERT ON public.quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_quote_request_push();
