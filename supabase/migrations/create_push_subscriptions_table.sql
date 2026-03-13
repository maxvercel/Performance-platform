-- Create push_subscriptions table for storing web push notification subscriptions

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_subscription_per_user UNIQUE(client_id, endpoint)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_client_id ON push_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Add updated_at trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER push_subscriptions_updated_at_trigger
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- Enable Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - users can only see their own subscriptions
CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (auth.uid() = client_id);

-- Create RLS policy - users can insert their own subscriptions
CREATE POLICY "Users can insert their own push subscriptions"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- Create RLS policy - users can update their own subscriptions
CREATE POLICY "Users can update their own push subscriptions"
  ON push_subscriptions
  FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Create RLS policy - users can delete their own subscriptions
CREATE POLICY "Users can delete their own push subscriptions"
  ON push_subscriptions
  FOR DELETE
  USING (auth.uid() = client_id);

-- Grant permissions to authenticated users
GRANT ALL ON push_subscriptions TO authenticated;
