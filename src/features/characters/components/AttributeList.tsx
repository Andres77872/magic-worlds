/**
 * AttributeList component
 * Reusable component for managing character attributes
 */

import { FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa';
import { useState } from 'react';
import { ConfirmDialog } from '../../../ui/components/ConfirmDialog';
import './CharacterCreator.css';

type AttributeType = 'stat' | 'skill' | 'trait' | 'equipment' | 'custom';

export interface AttributeCategory {
  id: string;
  name: string;
  type: AttributeType;
  description: string;
}

interface AttributeListProps {
  category: AttributeCategory;
  attributes: { key: string; value: string }[];
  onAddAttribute: () => void;
  onUpdateAttribute: (index: number, field: 'key' | 'value', value: string) => void;
  onRemoveAttribute: (index: number) => void;
  onDeleteCategory?: (categoryId: string) => void; // New prop for deleting a category
  isDeletable?: boolean; // Whether this category can be deleted
}

export const AttributeList = ({
  category,
  attributes,
  onAddAttribute,
  onUpdateAttribute,
  onRemoveAttribute,
  onDeleteCategory,
  isDeletable = false
}: AttributeListProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Handle delete category button click
  const handleDeleteClick = () => {
    // If there are attributes, show confirmation dialog
    if (attributes.length > 0) {
      setShowDeleteConfirm(true);
    } else {
      // If empty, delete immediately
      onDeleteCategory?.(category.id);
    }
  };

  return (
    <div className="attribute-section">
      <div className="attribute-header">
        <div className="attribute-title-area">
          <h3>{category.name}</h3>
          {category.description && (
            <p className="attribute-description">{category.description}</p>
          )}
        </div>
        <div className="attribute-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onAddAttribute}
            title={`Add a new ${category.name.slice(0, -1)}`}
          >
            <FaPlus /> Add {category.name.slice(0, -1)}
          </button>
          {isDeletable && onDeleteCategory && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleDeleteClick}
              title={`Delete ${category.name} category`}
            >
              <FaTrashAlt /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="attributes-list">
        {attributes.length === 0 && (
          <div className="empty-attributes">
            <p>No {category.name.toLowerCase()} added yet. Click the button above to add some.</p>
          </div>
        )}

        {attributes.map((attr, index) => (
          <div key={index} className="attribute-row">
            <input
              className="field-input attribute-key"
              type="text"
              placeholder={`${category.name.slice(0, -1)} name`}
              value={attr.key}
              onChange={(e) => onUpdateAttribute(index, 'key', e.target.value)}
            />
            <input
              className="field-input attribute-value"
              type="text"
              placeholder="Value"
              value={attr.value}
              onChange={(e) => onUpdateAttribute(index, 'value', e.target.value)}
            />
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => onRemoveAttribute(index)}
              title="Remove"
            >
              <FaTimes />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation dialog */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title={`Delete ${category.name}`}
        message={
          <>
            <p>Are you sure you want to delete the <strong>{category.name}</strong> category?</p>
            <p>This will remove {attributes.length} attribute{attributes.length !== 1 ? 's' : ''} associated with this category.</p>
          </>
        }
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDeleteCategory?.(category.id);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmLabel="Delete Category"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
};
