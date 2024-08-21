import { isSQLExpression } from './expression.js';
import { asColumn, asRelation, isColumnRefFor, Ref } from './ref.js';

export class Query {

  static select(...expr) {
    return new Query().select(...expr);
  }

  static from(...expr) {
    return new Query().from(...expr);
  }

  static with(...expr) {
    return new Query().with(...expr);
  }

  static union(...queries) {
    return new SetOperation('UNION', queries.flat());
  }

  static unionAll(...queries) {
    return new SetOperation('UNION ALL', queries.flat());
  }

  static intersect(...queries) {
    return new SetOperation('INTERSECT', queries.flat());
  }

  static except(...queries) {
    return new SetOperation('EXCEPT', queries.flat());
  }

  static describe(query) {
    const q = query.clone();
    const { clone, toString } = q;
    return Object.assign(q, {
      describe: true,
      clone: () => Query.describe(clone.call(q)),
      toString: () => `DESCRIBE ${toString.call(q)}`
    });
  }

  constructor() {
    this.query = {
      with: [],
      select: [],
      from: [],
      where: [],
      groupby: [],
      having: [],
      window: [],
      qualify: [],
      orderby: []
    };
    this.cteFor = null;
  }

  clone() {
    const q = new Query();
    q.query = { ...this.query };
    return q;
  }

  /**
   * Retrieve current WITH common table expressions (CTEs).
   * @returns {any[]}
   *//**
   * Add WITH common table expressions (CTEs).
   * @param  {...any} expr Expressions to add.
   * @returns {this}
   */
  with(...expr) {
    const { query } = this;
    if (expr.length === 0) {
      // @ts-ignore
      return query.with;
    } else {
      const list = [];
      const add = (as, q) => {
        const query = q.clone();
        query.cteFor = this;
        list.push({ as, query });
      };
      expr.flat().forEach(e => {
        if (e == null) {
          // do nothing
        } else if (e.as && e.query) {
          add(e.as, e.query);
        } else {
          for (const as in e) {
            add(as, e[as]);
          }
        }
      });
      query.with = query.with.concat(list);
      return this;
    }
  }

  /**
   * Retrieve current SELECT expressions.
   * @returns {any[]}
   *//**
   * Add SELECT expressions.
   * @param {...any} expr Expressions to add.
   * @returns {this}
   */
  select(...expr) {
    const { query } = this;
    if (expr.length === 0) {
      // @ts-ignore
      return query.select;
    } else {
      const list = [];
      for (const e of expr.flat()) {
        if (e == null) {
          // do nothing
        } else if (typeof e === 'string') {
          list.push({ as: e, expr: asColumn(e) });
        } else if (e instanceof Ref) {
          list.push({ as: e.column, expr: e });
        } else if (Array.isArray(e)) {
          list.push({ as: e[0], expr: e[1] });
        } else {
          for (const as in e) {
            list.push({ as: unquote(as), expr: asColumn(e[as]) });
          }
        }
      }

      const keys = new Set(list.map(x => x.as));
      query.select = query.select
        .filter(x => !keys.has(x.as))
        .concat(list.filter(x => x.expr));
      return this;
    }
  }

  $select(...expr) {
    this.query.select = [];
    return this.select(...expr);
  }

  distinct(value = true) {
    this.query.distinct = !!value;
    return this;
  }

  /**
   * Retrieve current from expressions.
   * @returns {any[]}
   *//**
   * Provide table from expressions.
   * @param  {...any} expr
   * @returns {this}
   */
  from(...expr) {
    const { query } = this;
    if (expr.length === 0) {
      // @ts-ignore
      return query.from;
    } else {
      const list = [];
      expr.flat().forEach(e => {
        if (e == null) {
          // do nothing
        } else if (typeof e === 'string') {
          list.push({ as: e, from: asRelation(e) });
        } else if (e instanceof Ref) {
          list.push({ as: e.table, from: e });
        } else if (isQuery(e) || isSQLExpression(e)) {
          list.push({ from: e });
        } else if (Array.isArray(e)) {
          list.push({ as: unquote(e[0]), from: asRelation(e[1]) });
        } else {
          for (const as in e) {
            list.push({ as: unquote(as), from: asRelation(e[as]) });
          }
        }
      });
      query.from = query.from.concat(list);
      return this;
    }
  }

  $from(...expr) {
    this.query.from = [];
    return this.from(...expr);
  }

  /**
   * Retrieve current SAMPLE settings.
   * @returns {any[]}
   *//**
   * Set SAMPLE settings.
   * @param {number|object} value The percentage or number of rows to sample.
   * @param {string} [method] The sampling method to use.
   * @returns {this}
   */
  sample(value, method) {
    const { query } = this;
    if (arguments.length === 0) {
      // @ts-ignore
      return query.sample;
    } else {
      let spec = value;
      if (typeof value === 'number') {
        spec = value > 0 && value < 1
            ? { perc: 100 * value, method }
            : { rows: Math.round(value), method };
      }
      query.sample = spec;
      return this;
    }
  }

  /**
   * Retrieve current WHERE expressions.
   * @returns {any[]}
   *//**
   * Add WHERE expressions.
   * @param  {...any} expr Expressions to add.
   * @returns {this}
   */
  where(...expr) {
    const { query } = this;
    if (expr.length === 0) {
      // @ts-ignore
      return query.where;
    } else {
      query.where = query.where.concat(
        expr.flat().filter(x => x)
      );
      return this;
    }
  }

  $where(...expr) {
    this.query.where = [];
    return this.where(...expr);
  }

  /**
   * Retrieve current GROUP BY expressions.
   * @returns {any[]}
   *//**
   * Add GROUP BY expressions.
   * @param  {...any} expr Expressions to add.
   * @returns {this}
   */
  groupby(...expr) {
    const { query } = this;
    if (expr.length === 0) {
      // @ts-ignore
      return query.groupby;
    } else {
      query.groupby = query.groupby.concat(
        expr.flat().filter(x => x).map(asColumn)
      );
      return this;
    }
  }

  $groupby(...expr) {
    this.query.groupby = [];
    return this.groupby(...expr);
  }

  /**
   * Retrieve current HAVING expressions.
   * @returns {any[]}
   *//**
   * Add HAVING expressions.
   * @param  {...any} expr Expressions to add.
   * @returns {this}
   */
  having(...expr) {
    const { query } = this;
    if (expr.length === 0) {
      // @ts-ignore
      return query.having;
    } else {
      query.having = query.having.concat(
        expr.flat().filter(x => x)
      );
      return this;
    }
  }

  /**
   * Retrieve current WINDOW definitions.
   * @returns {any[]}
   *//**
   * Add WINDOW definitions.
   * @param  {...any} expr Expressions to add.
   * @returns {this}
   */
  window(...expr) {
    const { query } = this;
    if (expr.length === 0) {
      // @ts-ignore
      return query.window;
    } else {
      const list = [];
      expr.flat().forEach(e => {
        if (e == null) {
          // do nothing
        } else {
          for (const as in e) {
            list.push({ as: unquote(as), expr: e[as] });
          }
        }
      });
      query.window = query.window.concat(list);
      return this;
    }
  }

  /**
   * Retrieve current QUALIFY expressions.
   * @returns {any[]}
   *//**
   * Add QUALIFY expressions.
   * @param  {...any} expr Expressions to add.
   * @returns {this}
   */
  qualify(...expr) {
    const { query } = this;
    if (expr.length === 0) {
      // @ts-ignore
      return query.qualify;
    } else {
      query.qualify = query.qualify.concat(
        expr.flat().filter(x => x)
      );
      return this;
    }
  }

  /**
   * Retrieve current ORDER BY expressions.
   * @returns {any[]}
   *//**
   * Add ORDER BY expressions.
   * @param  {...any} expr Expressions to add.
   * @returns {this}
   */
  orderby(...expr) {
    const { query } = this;
    if (expr.length === 0) {
      // @ts-ignore
      return query.orderby;
    } else {
      query.orderby = query.orderby.concat(
        expr.flat().filter(x => x).map(asColumn)
      );
      return this;
    }
  }

  /**
   * Retrieve current LIMIT value.
   * @returns {number|null}
   *//**
   * Set the query result LIMIT.
   * @param {number} value The limit value.
   * @returns {this}
   */
  limit(value) {
    const { query } = this;
    if (arguments.length === 0) {
      return query.limit;
    } else {
      query.limit = Number.isFinite(value) ? value : undefined;
      return this;
    }
  }

  /**
   * Retrieve current OFFSET value.
   * @returns {number|null}
   *//**
   * Set the query result OFFSET.
   * @param {number} value The offset value.
   * @returns {this}
   */
  offset(value) {
    const { query } = this;
    if (arguments.length === 0) {
      return query.offset;
    } else {
      query.offset = Number.isFinite(value) ? value : undefined;
      return this;
    }
  }

  get subqueries() {
    const { query, cteFor } = this;
    const ctes = (cteFor?.query || query).with;
    const cte = ctes?.reduce((o, {as, query}) => (o[as] = query, o), {});
    const q = [];
    query.from.forEach(({ from }) => {
      if (isQuery(from)) {
        q.push(from);
      } else if (cte[from.table]) {
        const sub = cte[from.table];
        q.push(sub);
      }
    });
    return q;
  }

  toString(params = []) {
    const {
      with: cte, select, distinct, from, sample, where, groupby,
      having, window, qualify, orderby, limit, offset
    } = this.query;

    const sql = [];

    // WITH
    if (cte.length) {
      const list = cte.map(({ as, query })=> `"${as.toString(params)}" AS (${query})`);
      sql.push(`WITH ${list.join(', ')}`);
    }

    // SELECT
    const sels = select.map(
      ({ as, expr }) => isColumnRefFor(expr, as) && !expr.table
        ? `${expr}`
        : `${expr} AS "${as}"`
    );
    sql.push(`SELECT${distinct ? ' DISTINCT' : ''} ${sels.join(', ')}`);

    // FROM
    if (from.length) {
      const rels = from.map(({ as, from }) => {
        const rel = isQuery(from) ? `(${from})` : `${from}`;
        return !as || as === from.table ? rel : `${rel} AS "${as}"`;
      });
      sql.push(`FROM ${rels.join(', ')}`);
    }

    // WHERE
    if (where.length) {
      const clauses = where.map(c => c.toString(params)).filter(x => x).join(' AND ');
      if (clauses) sql.push(`WHERE ${clauses}`);
    }

    // SAMPLE
    if (sample) {
      const { rows, perc, method, seed } = sample;
      const size = rows ? `${rows} ROWS` : `${perc} PERCENT`;
      const how = method ? ` (${method}${seed != null ? `, ${seed}` : ''})` : '';
      sql.push(`USING SAMPLE ${size}${how}`);
    }

    // GROUP BY
    if (groupby.length) {
      sql.push(`GROUP BY ${groupby.join(', ')}`);
    }

    // HAVING
    if (having.length) {
      const clauses = having.map(c => c.toString(params)).filter(x => x).join(' AND ');
      if (clauses) sql.push(`HAVING ${clauses}`);
    }

    // WINDOW
    if (window.length) {
      const windows = window.map(({ as, expr }) => `"${as.toString(params)}" AS (${expr})`);
      sql.push(`WINDOW ${windows.join(', ')}`);
    }

    // QUALIFY
    if (qualify.length) {
      const clauses = qualify.map(String).filter(x => x).join(' AND ');
      if (clauses) sql.push(`QUALIFY ${clauses}`);
    }

    // ORDER BY
    if (orderby.length) {
      sql.push(`ORDER BY ${orderby.join(', ')}`);
    }

    // LIMIT
    if (Number.isFinite(limit)) {
      sql.push(`LIMIT ${limit}`);
    }

    // OFFSET
    if (Number.isFinite(offset)) {
      sql.push(`OFFSET ${offset}`);
    }

    return sql.join(' ');
  }
}

export class SetOperation {
  constructor(op, queries) {
    this.op = op;
    this.queries = queries.map(q => q.clone());
    this.query = { orderby: [] };
    this.cteFor = null;
  }

  clone() {
    const q = new SetOperation(this.op, this.queries);
    q.query = { ...this.query };
    return q;
  }

  orderby(...expr) {
    const { query } = this;
    if (expr.length === 0) {
      return query.orderby;
    } else {
      query.orderby = query.orderby.concat(
        expr.flat().filter(x => x).map(asColumn)
      );
      return this;
    }
  }

  limit(value) {
    const { query } = this;
    if (arguments.length === 0) {
      return query.limit;
    } else {
      query.limit = Number.isFinite(value) ? value : undefined;
      return this;
    }
  }

  offset(value) {
    const { query } = this;
    if (arguments.length === 0) {
      return query.offset;
    } else {
      query.offset = Number.isFinite(value) ? value : undefined;
      return this;
    }
  }

  get subqueries() {
    const { queries, cteFor } = this;
    if (cteFor) queries.forEach(q => q.cteFor = cteFor);
    return queries;
  }

  toString() {
    const { op, queries, query: { orderby, limit, offset } } = this;

    // SUBQUERIES
    const sql = [ queries.join(` ${op} `) ];

    // ORDER BY
    if (orderby.length) {
      sql.push(`ORDER BY ${orderby.join(', ')}`);
    }

    // LIMIT
    if (Number.isFinite(limit)) {
      sql.push(`LIMIT ${limit}`);
    }

    // OFFSET
    if (Number.isFinite(offset)) {
      sql.push(`OFFSET ${offset}`);
    }

    return sql.join(' ');
  }
}

export function isQuery(value) {
  return value instanceof Query || value instanceof SetOperation;
}

export function isDescribeQuery(value) {
  // @ts-ignore
  return isQuery(value) && value.describe;
}

function unquote(s) {
  return isDoubleQuoted(s) ? s.slice(1, -1) : s;
}

function isDoubleQuoted(s) {
  return s[0] === '"' && s[s.length-1] === '"';
}
