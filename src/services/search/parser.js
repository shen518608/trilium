"use strict";

const AndExp = require('./expressions/and');
const OrExp = require('./expressions/or');
const NotExp = require('./expressions/not');
const ChildOfExp = require('./expressions/child_of');
const PropertyComparisonExp = require('./expressions/property_comparison');
const AttributeExistsExp = require('./expressions/attribute_exists');
const LabelComparisonExp = require('./expressions/label_comparison');
const NoteCacheFulltextExp = require('./expressions/note_cache_fulltext');
const NoteContentFulltextExp = require('./expressions/note_content_fulltext');
const comparatorBuilder = require('./comparator_builder');

function getFulltext(tokens, parsingContext) {
    parsingContext.highlightedTokens.push(...tokens);

    if (tokens.length === 0) {
        return null;
    }
    else if (parsingContext.includeNoteContent) {
        return new OrExp([
            new NoteCacheFulltextExp(tokens),
            new NoteContentFulltextExp(tokens)
        ]);
    }
    else {
        return new NoteCacheFulltextExp(tokens);
    }
}

function isOperator(str) {
    return str.match(/^[=<>*]+$/);
}

function getExpression(tokens, parsingContext) {
    if (tokens.length === 0) {
        return null;
    }

    const expressions = [];
    let op = null;

    let i;

    function parseNoteProperty() {
        if (tokens[i] !== '.') {
            parsingContext.addError('Expected "." to separate field path');
            return;
        }

        i++;

        if (tokens[i] === 'parent') {
            i += 1;

            return new ChildOfExp(parseNoteProperty());
        }

        if (tokens[i] === 'title') {
            const propertyName = tokens[i];
            const operator = tokens[i + 1];
            const comparedValue = tokens[i + 2];
            const comparator = comparatorBuilder(operator, comparedValue);

            if (!comparator) {
                parsingContext.addError(`Can't find operator '${operator}'`);
                return;
            }

            i += 3;

            return new PropertyComparisonExp(propertyName, comparator);
        }
    }

    for (i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token === '#' || token === '~') {
            continue;
        }

        if (Array.isArray(token)) {
            expressions.push(getExpression(token, parsingContext));
        }
        else if (token.startsWith('#') || token.startsWith('~')) {
            const type = token.startsWith('#') ? 'label' : 'relation';

            parsingContext.highlightedTokens.push(token.substr(1));

            if (i < tokens.length - 2 && isOperator(tokens[i + 1])) {
                let operator = tokens[i + 1];
                const comparedValue = tokens[i + 2];

                parsingContext.highlightedTokens.push(comparedValue);

                if (parsingContext.fuzzyAttributeSearch && operator === '=') {
                    operator = '*=*';
                }

                const comparator = comparatorBuilder(operator, comparedValue);

                if (!comparator) {
                    parsingContext.addError(`Can't find operator '${operator}'`);
                    continue;
                }

                expressions.push(new LabelComparisonExp(type, token.substr(1), comparator));

                i += 2;
            }
            else {
                expressions.push(new AttributeExistsExp(type, token.substr(1), parsingContext.fuzzyAttributeSearch));
            }
        }
        else if (token === 'note') {
            i++;

            expressions.push(parseNoteProperty(tokens));

            continue;
        }
        else if (['and', 'or'].includes(token)) {
            if (!op) {
                op = token;
            }
            else if (op !== token) {
                parsingContext.addError('Mixed usage of AND/OR - always use parenthesis to group AND/OR expressions.');
            }
        }
        else if (isOperator(token)) {
            parsingContext.addError(`Misplaced or incomplete expression "${token}"`);
        }
        else {
            parsingContext.addError(`Unrecognized expression "${token}"`);
        }

        if (!op && expressions.length > 1) {
            op = 'and';
        }
    }

    if (op === null || op === 'and') {
        return AndExp.of(expressions);
    }
    else if (op === 'or') {
        return OrExp.of(expressions);
    }
}

function parse({fulltextTokens, expressionTokens, parsingContext}) {
    return AndExp.of([
        getFulltext(fulltextTokens, parsingContext),
        getExpression(expressionTokens, parsingContext)
    ]);
}

module.exports = parse;