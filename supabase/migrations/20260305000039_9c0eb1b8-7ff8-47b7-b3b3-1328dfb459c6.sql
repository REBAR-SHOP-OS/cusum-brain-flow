
CREATE UNIQUE INDEX idx_scheduled_activities_dedup 
ON scheduled_activities (entity_id, activity_type, summary, due_date)
WHERE entity_type = 'lead';
