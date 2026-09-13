export const pagination = (query = {}) => {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 10), 1), 100);
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

export const buildSetClause = (body, allowedFields, startIndex = 1) => {
  const fields = [];
  const values = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      fields.push(field);
      values.push(body[field]);
    }
  }

  const setClause = fields.map((field, index) => `${field} = $${startIndex + index}`).join(", ");
  return { fields, values, setClause };
};

export const appendFilter = (conditions, values, column, value, operator = "=") => {
  if (value === undefined || value === null || value === "") {
    return;
  }

  if (operator === "ILIKE") {
    values.push(`%${value}%`);
  } else {
    values.push(value);
  }

  conditions.push(`${column} ${operator} $${values.length}`);
};
