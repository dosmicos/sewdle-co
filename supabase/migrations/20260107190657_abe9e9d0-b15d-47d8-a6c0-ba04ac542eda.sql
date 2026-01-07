-- Create messaging_channels table for multi-channel support
CREATE TABLE public.messaging_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('whatsapp', 'instagram', 'messenger')),
  channel_name TEXT,
  channel_identifier TEXT, -- phone number or username
  meta_account_id TEXT, -- WABA ID or IG Business Account ID
  meta_phone_number_id TEXT, -- WhatsApp specific
  meta_page_id TEXT, -- Instagram/Messenger specific
  is_active BOOLEAN DEFAULT true,
  webhook_verified BOOLEAN DEFAULT false,
  ai_enabled BOOLEAN DEFAULT true,
  ai_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create messaging_conversations table
CREATE TABLE public.messaging_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES messaging_channels(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('whatsapp', 'instagram', 'messenger')),
  external_user_id TEXT NOT NULL, -- wa_id or ig_user_id
  user_name TEXT,
  user_identifier TEXT, -- phone or username
  profile_pic_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'resolved')),
  ai_managed BOOLEAN DEFAULT true,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create messaging_messages table
CREATE TABLE public.messaging_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES messaging_conversations(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  external_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai', 'agent')),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'story_reply', 'reaction')),
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  reply_to_message_id UUID REFERENCES messaging_messages(id),
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT
);

-- Create indexes for performance
CREATE INDEX idx_messaging_channels_org ON messaging_channels(organization_id);
CREATE INDEX idx_messaging_channels_type ON messaging_channels(channel_type);
CREATE INDEX idx_messaging_conversations_org ON messaging_conversations(organization_id);
CREATE INDEX idx_messaging_conversations_channel ON messaging_conversations(channel_id);
CREATE INDEX idx_messaging_conversations_status ON messaging_conversations(status);
CREATE INDEX idx_messaging_conversations_last_message ON messaging_conversations(last_message_at DESC);
CREATE INDEX idx_messaging_messages_conversation ON messaging_messages(conversation_id);
CREATE INDEX idx_messaging_messages_sent_at ON messaging_messages(sent_at DESC);
CREATE UNIQUE INDEX idx_messaging_conversations_external_user ON messaging_conversations(channel_id, external_user_id);

-- Enable RLS
ALTER TABLE public.messaging_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for messaging_channels
CREATE POLICY "Users can view channels in their organization"
  ON public.messaging_channels FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage channels"
  ON public.messaging_channels FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));

-- RLS policies for messaging_conversations
CREATE POLICY "Users can view conversations in their organization"
  ON public.messaging_conversations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage conversations in their organization"
  ON public.messaging_conversations FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

-- RLS policies for messaging_messages
CREATE POLICY "Users can view messages in their organization"
  ON public.messaging_messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM messaging_conversations WHERE organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage messages in their organization"
  ON public.messaging_messages FOR ALL
  USING (conversation_id IN (
    SELECT id FROM messaging_conversations WHERE organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  ));

-- Trigger for updated_at
CREATE TRIGGER update_messaging_channels_updated_at
  BEFORE UPDATE ON messaging_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messaging_conversations_updated_at
  BEFORE UPDATE ON messaging_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();