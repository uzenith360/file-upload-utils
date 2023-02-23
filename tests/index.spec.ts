import 'mocha';
import { assert } from 'chai';

import { getPreviewFileData, FileData } from '../src/index';
import * as npmPackage from '../src/index';

describe('NPM Package', () => {
    it('should be an object', () => {
        assert.isObject(npmPackage);
    });

    it('should have a FileData property', () => {
        assert.exists(npmPackage, 'FileData');
    });
});

describe('Get Preview FileData Function', () => {
    it('should be a function', () => {
        assert.isFunction(getPreviewFileData);
    });
});
