const _ = require('lodash');
module.exports = class PermissionsTemplate {
  static create() {
    return new PermissionsTemplate();
  }
  parsePermissions(rawPath, context, rawPermissions) {
    try {
      if (rawPath.indexOf('{{') === -1) {
        // no substitution, so return
        return [
          {
            [rawPath]: rawPermissions
          }
        ];
      }
      const tags = this.getTags(rawPath, context);
      let variations = [];
      for (let tag of tags) {
        if (Array.isArray(tag.value)) {
          variations = variations.concat(new Array(tag.value.length).fill(rawPath));
        } else {
          if (variations.length === 0) {
            variations = [rawPath];
          }
        }
      }
      return variations.map(variation => {
        return { [variation]: rawPermissions };
      });
    } catch (e) {
      throw new Error(`failed parsing permissions: ${e.message}`);
    }
  }
  getTags(rawPath, context) {
    return rawPath
      .split('{{')
      .slice(1)
      .map(item => {
        return item.split('}}')[0];
      })
      .map(key => {
        return {
          key,
          value: _.get(context, key)
        };
      })
      .filter(tag => {
        return tag.value != null;
      });
    //   .reduce((tuples, tag) => {
    //     if (!Array.isArray(tag.value)) {
    //       tuples.push(tag);
    //     }

    //     tag.value.forEach(branch => {
    //       tuples.push(branch);
    //     });

    //     return tag;
    //   }, []);
  }
};
