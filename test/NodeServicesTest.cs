// Copyright (c) .NET Foundation. All rights reserved.
// Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.

using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.NodeServices.HostingModels;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Microsoft.AspNetCore.NodeServices
{
    [Obsolete("Use Microsoft.AspNetCore.SpaServices.Extensions")]
    public class NodeServicesTest : IDisposable
    {
        private readonly INodeServices _nodeServices;

        public NodeServicesTest()
        {
            // In typical ASP.NET Core applications, INodeServices is made available
            // through DI using services.AddNodeServices(). But for these tests we
            // create our own INodeServices instance manually, since the tests are
            // not about DI (and we might want different config for each test).
            var serviceProvider = new ServiceCollection().BuildServiceProvider();
            var options = new NodeServicesOptions(serviceProvider) { InvocationTimeoutMilliseconds = 5000 };
            _nodeServices = NodeServicesFactory.CreateNodeServices(options);
        }

# region CommonJS        

        [Fact]
        public async Task CanGetSuccessResult_CJS()
        {
            // Act
            var result = await _nodeServices.InvokeExportAsync<string>(
                CjsModulePath("testCases"),
                "getFixedString");

            // Assert
            Assert.Equal("test result", result);
        }

        [Fact]
        public async Task CanGetErrorResult_CJS()
        {
            // Act/Assert
            var ex = await Assert.ThrowsAsync<NodeInvocationException>(() =>
                _nodeServices.InvokeExportAsync<string>(
                    CjsModulePath("testCases"),
                    "raiseError"));
            Assert.StartsWith("This is an error from Node", ex.Message);
        }

        [Fact]
        public async Task CanGetResultAsynchronously_CJS()
        {
            // Act
            // All the invocations are async, but this test shows we're not reliant
            // on the response coming back immediately
            var result = await _nodeServices.InvokeExportAsync<string>(
                CjsModulePath("testCases"),
                "getFixedStringWithDelay");

            // Assert
            Assert.Equal("delayed test result", result);
        }

        [Fact]
        public async Task CanPassParameters_CJS()
        {
            // Act
            var result = await _nodeServices.InvokeExportAsync<string>(
                CjsModulePath("testCases"),
                "echoSimpleParameters",
                "Hey",
                123);

            // Assert
            Assert.Equal("Param0: Hey; Param1: 123", result);
        }

        [Fact]
        public async Task CanPassParametersWithCamelCaseNameConversion_CJS()
        {
            // Act
            var result = await _nodeServices.InvokeExportAsync<string>(
                CjsModulePath("testCases"),
                "echoComplexParameters",
                new ComplexModel { StringProp = "Abc", IntProp = 123, BoolProp = true });

            // Assert
            Assert.Equal("Received: [{\"stringProp\":\"Abc\",\"intProp\":123,\"boolProp\":true}]", result);
        }

        [Fact]
        public async Task CanReceiveComplexResultWithPascalCaseNameConversion_CJS()
        {
            // Act
            var result = await _nodeServices.InvokeExportAsync<ComplexModel>(
                CjsModulePath("testCases"),
                "getComplexObject");

            // Assert
            Assert.Equal("Hi from Node", result.StringProp);
            Assert.Equal(456, result.IntProp);
            Assert.True(result.BoolProp);
        }

        [Fact]
        public async Task CanInvokeDefaultModuleExport_CJS()
        {
            // Act
            var result = await _nodeServices.InvokeAsync<string>(
                CjsModulePath("moduleWithDefaultExport"),
                "This is from .NET");

            // Assert
            Assert.Equal("Hello from the default export. You passed: This is from .NET", result);
        }

# endregion CommonJS
# region ESM modules

        [Fact]
        public async Task CanGetSuccessResult_ESM()
        {
            // Act
            var result = await _nodeServices.InvokeExportAsync<string>(
                MjsModulePath("testCases"),
                "getFixedString");

            // Assert
            Assert.Equal("test result", result);
        }

        [Fact]
        public async Task CanGetErrorResult_ESM()
        {
            // Act/Assert
            var ex = await Assert.ThrowsAsync<NodeInvocationException>(() =>
                _nodeServices.InvokeExportAsync<string>(
                    MjsModulePath("testCases"),
                    "raiseError"));
            Assert.StartsWith("This is an error from Node", ex.Message);
        }

        [Fact]
        public async Task CanGetResultAsynchronously_ESM()
        {
            // Act
            // All the invocations are async, but this test shows we're not reliant
            // on the response coming back immediately
            var result = await _nodeServices.InvokeExportAsync<string>(
                MjsModulePath("testCases"),
                "getFixedStringWithDelay");

            // Assert
            Assert.Equal("delayed test result", result);
        }

        [Fact]
        public async Task CanPassParameters_ESM()
        {
            // Act
            var result = await _nodeServices.InvokeExportAsync<string>(
                MjsModulePath("testCases"),
                "echoSimpleParameters",
                "Hey",
                123);

            // Assert
            Assert.Equal("Param0: Hey; Param1: 123", result);
        }

        [Fact]
        public async Task CanPassParametersWithCamelCaseNameConversion_ESM()
        {
            // Act
            var result = await _nodeServices.InvokeExportAsync<string>(
                MjsModulePath("testCases"),
                "echoComplexParameters",
                new ComplexModel { StringProp = "Abc", IntProp = 123, BoolProp = true });

            // Assert
            Assert.Equal("Received: [{\"stringProp\":\"Abc\",\"intProp\":123,\"boolProp\":true}]", result);
        }

        [Fact]
        public async Task CanReceiveComplexResultWithPascalCaseNameConversion_ESM()
        {
            // Act
            var result = await _nodeServices.InvokeExportAsync<ComplexModel>(
                MjsModulePath("testCases"),
                "getComplexObject");

            // Assert
            Assert.Equal("Hi from Node", result.StringProp);
            Assert.Equal(456, result.IntProp);
            Assert.True(result.BoolProp);
        }

        [Fact]
        public async Task CanInvokeDefaultModuleExport_ESM()
        {
            // Act
            var result = await _nodeServices.InvokeAsync<string>(
                MjsModulePath("moduleWithDefaultExport"),
                "This is from .NET");

            // Assert
            Assert.Equal("Hello from the default export. You passed: This is from .NET", result);
        }

# endregion ESM modules
        
        private static string CjsModulePath(string testModuleName)
            => Path.Combine(AppContext.BaseDirectory, "js", $"{testModuleName}"); // .js
        
        /// <summary>
        /// .mjs file extension is mandatory to treat the file as ES module,
        /// check isESM in HttpNodeInstanceEntryPoint.ts
        /// </summary>
        /// <param name="testModuleName"></param>
        /// <returns></returns>
        private static string MjsModulePath(string testModuleName)
            => Path.Combine(AppContext.BaseDirectory, "js", $"{testModuleName}.mjs");

        public void Dispose()
        {
            _nodeServices.Dispose();
        }

        class ComplexModel
        {
            public string StringProp { get; set; }

            public int IntProp { get; set; }

            public bool BoolProp { get; set; }
        }
    }
}
