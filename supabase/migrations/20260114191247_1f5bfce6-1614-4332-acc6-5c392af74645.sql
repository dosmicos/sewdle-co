-- Agregar FK a material_transfers.material_id
ALTER TABLE material_transfers
ADD CONSTRAINT material_transfers_material_id_fkey 
FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT;

-- Agregar FK a material_inventory.material_id
ALTER TABLE material_inventory
ADD CONSTRAINT material_inventory_material_id_fkey 
FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT;